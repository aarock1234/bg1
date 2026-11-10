import { setTimeout as sleep } from 'node:timers/promises';

import { type AutoBookAttempt, autoBook } from '@/api/ll/auto-book';
import { ParkTime } from '@/datetime';
import { RateLimit } from '@/ratelimit';

import { describeError } from '../describe-error';
import { llClientFor, resortFor } from '../disney/clients';
import {
  type DisneyLogin,
  type LoginAuth,
  loginAuth,
} from '../disney/credentials';
import { decryptLogin, encryptLogin } from '../disney/login-crypto';
import { type ProxiedFetch, proxiedFetch } from '../disney/proxies';
import {
  LoginRefreshFailed,
  canRefresh,
  refreshLogin,
} from '../disney/refresh';
import { logger } from '../log';
import { sendPush } from '../push/notify';
import type { Job, JobOutcome, JobProgress } from './job';
import { outcomeNotification } from './notification';
import {
  LOGIN_EXPIRED,
  WINDOW_OVER,
  available,
  booked,
  outcomeOfError,
} from './outcome';
import {
  type Lease,
  finishJob,
  releaseLease,
  renewLease,
  saveLogin,
} from './repository';
import { watchForReturnTime } from './watch';
import { currentRange, isWindowOver, resortNow } from './window';

// How often a running job renews its lease, saves its progress, and checks
// that it should still be searching. Progress is saved at this pace instead
// of after every check, which can come several times a second.
const HEARTBEAT_INTERVAL_MS = 5000;

// How long before the access token expires a refresh is first tried, and how
// long to wait before trying again after a failed one.
const REFRESH_MARGIN_MS = 30 * 60_000;
const REFRESH_RETRY_MS = 5 * 60_000;

// How often to try recording a job's outcome while the database is failing.
const RECORD_ATTEMPTS = 4;
const RECORD_RETRY_DELAY_MS = 2000;

// Why a search was stopped before it ended on its own.
export const StopReason = {
  // The server is shutting down; another instance continues the search.
  SHUTDOWN: 'shutdown',

  // The guest cancelled the job.
  CANCELLED: 'cancelled',

  // The job is no longer this instance's to run.
  LEASE_LOST: 'lease-lost',

  WINDOW_OVER: 'window-over',
  LOGIN_EXPIRED: 'login-expired',

  // The search ended on its own and only its supervision is left to stop.
  SETTLED: 'settled',
} as const;

export type StopReason = (typeof StopReason)[keyof typeof StopReason];

// The reasons a job's owner may stop it for.
export type OwnerStopReason =
  typeof StopReason.SHUTDOWN | typeof StopReason.CANCELLED;

class SearchStopped extends Error {
  readonly name = 'SearchStopped';

  constructor(readonly reason: StopReason) {
    super(`search stopped: ${reason}`);
  }
}

// What a job does once a return time in range comes up: book it, or tell the
// guest so they can book it in the Disney app.
export const JobAction = {
  BOOK: 'book',
  NOTIFY: 'notify',
} as const;

export type JobAction = (typeof JobAction)[keyof typeof JobAction];

export type RunnerOptions = {
  // Identifies this server instance in the jobs' leases.
  owner: string;
  action: JobAction;
  leaseMs: number;

  // How long to wait between two checks when booking, and between two looks
  // at the tip board when only notifying.
  pollIntervalMs: number;
  watchPollIntervalMs: number;
  requestsPerSecond: number;

  // The proxies to send requests to Disney through. With none, requests go
  // out directly.
  proxyUrls: string[];
};

// A job this instance is running.
export type RunningJob = {
  // Settles once the job has stopped running here. It never rejects: the run
  // logs its own failure.
  done: Promise<void>;
  stop(reason: OwnerStopReason): void;
};

// How a run ended.
type Ending =
  | {
      kind: 'finished';
      outcome: JobOutcome;
    }
  | {
      // Handed back for another instance to continue.
      kind: 'released';
    }
  | {
      // The job was cancelled or taken over; nothing is left to record.
      kind: 'abandoned';
    };

// The guest's login as the search is using it. A refresh replaces it.
type Session = {
  login: DisneyLogin;
  auth: LoginAuth;
};

// Runs one job from the moment it is claimed until it ends or is handed
// back.
class JobRun {
  private readonly controller = new AbortController();
  private readonly lease: Lease;
  private readonly progress: JobProgress;
  private readonly log;
  private readonly proxy: ProxiedFetch | undefined;

  private leaseRenewedAt = Date.now();
  private nextRefreshAt = 0;

  // A refreshed login that still has to be written to the database.
  private unsavedLogin: DisneyLogin | undefined;

  constructor(
    private readonly job: Job,
    private readonly options: RunnerOptions
  ) {
    this.lease = {
      jobId: job.id,
      owner: options.owner,
    };
    this.progress = {
      attemptCount: job.attemptCount,
      lastAttempt: job.lastAttempt,
    };
    this.log = logger.child({
      jobId: job.id,
    });
    this.proxy =
      options.proxyUrls.length > 0
        ? proxiedFetch(options.proxyUrls)
        : undefined;
  }

  // Sends the run's requests to Disney, or undefined to send them directly.
  private get fetch(): typeof fetch | undefined {
    return this.proxy?.fetch;
  }

  stop(reason: StopReason): void {
    this.controller.abort(new SearchStopped(reason));
  }

  async run(): Promise<void> {
    this.log.info(
      {
        resortId: this.job.resortId,
        experienceId: this.job.experienceId,
        attempts: this.job.attemptCount,
      },
      'job started'
    );

    try {
      await this.conclude(await this.search());
    } finally {
      await this.closeProxy();
    }
  }

  private async closeProxy(): Promise<void> {
    try {
      await this.proxy?.close();
    } catch (error) {
      this.log.warn(describeError(error), 'proxy connections did not close');
    }
  }

  private async search(): Promise<Ending> {
    const { signal } = this.controller;
    let supervision: Promise<void> | undefined;

    try {
      const session = this.openSession();

      // The job may have been waiting for an instance to pick it up, so its
      // window and login are checked before the first request.
      await this.checkpoint(session);
      signal.throwIfAborted();

      supervision = this.supervise(session);

      return {
        kind: 'finished',
        outcome: await this.find(session),
      };
    } catch (error) {
      return this.endingOfError(error);
    } finally {
      this.stop(StopReason.SETTLED);
      await supervision;
    }
  }

  private openSession(): Session {
    if (this.job.encryptedLogin === null) {
      throw new Error('a searching job has no login');
    }

    const login = decryptLogin(this.job.encryptedLogin);

    return {
      login,
      auth: loginAuth(login),
    };
  }

  // Books a return time in range, or, when jobs only notify, waits for one
  // to come up.
  private async find(session: Session): Promise<JobOutcome> {
    if (this.options.action === JobAction.NOTIFY) {
      return available(this.job, await this.watch(session));
    }

    return booked(await this.autoBook(session));
  }

  private async watch(session: Session): Promise<ParkTime> {
    const { job, options } = this;
    const resort = await resortFor(job.resortId);
    const ll = await llClientFor(job.resortId, session.auth, {
      fetch: this.fetch,
      rateLimit: new RateLimit(options.requestsPerSecond),
    });

    return watchForReturnTime({
      ll,
      experienceId: job.experienceId,
      park: resort.experience(job.experienceId).park,
      date: job.bookingDate,
      currentRange: () => currentRange(job, resortNow(job.resortId).time),
      signal: this.controller.signal,
      pollIntervalMs: options.watchPollIntervalMs,
      onAttempt: attempt => this.recordAttempt(attempt),
    });
  }

  private async autoBook(session: Session) {
    const { job, options } = this;
    const resort = await resortFor(job.resortId);
    const ll = await llClientFor(job.resortId, session.auth, {
      fetch: this.fetch,
      rateLimit: new RateLimit(options.requestsPerSecond),
    });

    return autoBook({
      ll,
      experience: resort.experience(job.experienceId),
      guests: job.guests,
      range: {
        earliest: ParkTime.from(job.earliest),
        latest: ParkTime.from(job.latest),
      },
      offerOptions: {
        date: job.bookingDate,
      },
      signal: this.controller.signal,
      pollIntervalMs: options.pollIntervalMs,
      onAttempt: attempt => this.recordAttempt(attempt),
    });
  }

  private recordAttempt(attempt: AutoBookAttempt): void {
    if (attempt.kind === 'interrupted') {
      this.log.warn(
        {
          ...describeError(attempt.error),
          retryInMs: attempt.retryInMs,
        },
        'job check interrupted'
      );
    }

    this.progress.attemptCount += 1;
    this.progress.lastAttempt = {
      kind: attempt.kind,
      offeredTime:
        attempt.kind === 'outside-range'
          ? attempt.offeredTime.toString()
          : undefined,
      at: new Date().toISOString(),
    };
  }

  // Works out how the run ended from what stopped the search: the reason it
  // was stopped for, or else the error itself.
  private endingOfError(error: unknown): Ending {
    const { signal } = this.controller;
    const reason =
      signal.reason instanceof SearchStopped ? signal.reason.reason : undefined;

    switch (reason) {
      case StopReason.SHUTDOWN:
        return {
          kind: 'released',
        };
      case StopReason.CANCELLED:
      case StopReason.LEASE_LOST:
        return {
          kind: 'abandoned',
        };
      case StopReason.WINDOW_OVER:
        return {
          kind: 'finished',
          outcome: WINDOW_OVER,
        };
      case StopReason.LOGIN_EXPIRED:
        return {
          kind: 'finished',
          outcome: LOGIN_EXPIRED,
        };
      case StopReason.SETTLED:
      case undefined:
        this.log.warn(describeError(error), 'job search failed');

        return {
          kind: 'finished',
          outcome: outcomeOfError(error),
        };
    }
  }

  // Keeps the job alive while it searches. It ends when the search is
  // stopped, and stops the search itself when the job should not go on.
  private async supervise(session: Session): Promise<void> {
    const { signal } = this.controller;

    while (!signal.aborted) {
      try {
        await sleep(HEARTBEAT_INTERVAL_MS, undefined, {
          signal,
        });
      } catch {
        return;
      }

      // The heartbeat goes first: the checkpoint may refresh the login, which
      // can take long enough for the lease to lapse.
      try {
        await this.heartbeat();
        await this.checkpoint(session);
      } catch (error) {
        this.log.error(describeError(error), 'job heartbeat failed');
      }

      // Once the lease has lapsed another instance may be running the job.
      if (Date.now() - this.leaseRenewedAt > this.options.leaseMs) {
        this.stop(StopReason.LEASE_LOST);
      }
    }
  }

  // Stops the search when its window is over or its login has run out,
  // after giving the login a chance to be refreshed.
  private async checkpoint(session: Session): Promise<void> {
    if (isWindowOver(this.job, resortNow(this.job.resortId))) {
      this.stop(StopReason.WINDOW_OVER);
      return;
    }

    await this.refreshLoginIfDue(session);

    if (session.login.expires <= Date.now()) {
      this.stop(StopReason.LOGIN_EXPIRED);
    }
  }

  private async refreshLoginIfDue(session: Session): Promise<void> {
    const now = Date.now();
    const isDue = session.login.expires - now <= REFRESH_MARGIN_MS;

    if (!isDue || now < this.nextRefreshAt || !canRefresh(session.login, now)) {
      return;
    }

    try {
      const login = await refreshLogin(session.login, this.job.resortId, {
        fetch: this.fetch,
      });

      session.login = login;
      session.auth.replaceLogin(login);
      this.unsavedLogin = login;
      this.log.info('login refreshed');
    } catch (error) {
      this.nextRefreshAt = now + REFRESH_RETRY_MS;
      this.log.warn(
        {
          reason:
            error instanceof LoginRefreshFailed
              ? error.reason
              : 'unexpected failure',
        },
        'login refresh failed'
      );
    }
  }

  private async heartbeat(): Promise<void> {
    if (this.unsavedLogin) {
      await saveLogin({
        ...this.lease,
        encryptedLogin: encryptLogin(this.unsavedLogin),
        loginExpiresAt: new Date(this.unsavedLogin.expires),
      });
      this.unsavedLogin = undefined;
    }

    const isStillHeld = await renewLease({
      ...this.lease,
      leaseMs: this.options.leaseMs,
      progress: this.progress,
    });

    if (!isStillHeld) {
      this.stop(StopReason.LEASE_LOST);
      return;
    }

    this.leaseRenewedAt = Date.now();
  }

  private async conclude(ending: Ending): Promise<void> {
    if (ending.kind === 'abandoned') {
      this.log.info('job abandoned');
      return;
    }

    if (ending.kind === 'released') {
      await releaseLease(this.lease, this.progress);
      this.log.info('job released');
      return;
    }

    const { outcome } = ending;
    const wasRecorded = await this.record(outcome);

    this.log.info(
      {
        status: outcome.status,
        failureCode: 'failure' in outcome ? outcome.failure.code : undefined,
        attempts: this.progress.attemptCount,
        wasRecorded,
      },
      'job finished'
    );

    // Recording the outcome deleted the subscription from the database, so
    // this is the only notification it ever receives.
    if (wasRecorded && this.job.pushSubscription) {
      await sendPush(
        this.job.pushSubscription,
        outcomeNotification(this.job, outcome)
      );
    }
  }

  // Writes the outcome to the database, trying again when that fails: a
  // booking that goes unrecorded would be searched for again.
  private async record(outcome: JobOutcome): Promise<boolean> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await finishJob({
          ...this.lease,
          outcome,
          progress: this.progress,
        });
      } catch (error) {
        if (attempt >= RECORD_ATTEMPTS) {
          throw error;
        }

        await sleep(RECORD_RETRY_DELAY_MS);
      }
    }
  }
}

// Starts running a claimed job. The caller owns the run: it waits for `done`
// and may stop the job early.
export function startJob(job: Job, options: RunnerOptions): RunningJob {
  const run = new JobRun(job, options);

  const done = run.run().catch((error: unknown) => {
    logger.error(
      {
        jobId: job.id,
        ...describeError(error),
      },
      'job run failed'
    );
  });

  return {
    done,
    stop: reason => run.stop(reason),
  };
}
