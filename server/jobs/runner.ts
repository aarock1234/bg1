import { setTimeout as sleep } from 'node:timers/promises';

import { RequestError } from '@/api/client';
import { type AutoBookAttempt, autoBook } from '@/api/ll/auto-book';
import { ParkTime } from '@/datetime';
import { RateLimit } from '@/ratelimit';

import { llClientFor, resortFor } from '../disney/clients';
import {
  type DisneyLogin,
  type LoginAuth,
  loginAuth,
} from '../disney/credentials';
import { decryptLogin, encryptLogin } from '../disney/login-crypto';
import { proxiedFetch } from '../disney/proxies';
import {
  LoginRefreshFailed,
  canRefresh,
  refreshLogin,
} from '../disney/refresh';
import { logger } from '../log';
import { sendPush } from '../push/notify';
import type { Job, JobOutcome, JobProgress } from './job';
import { outcomeNotification } from './notification';
import { LOGIN_EXPIRED, WINDOW_OVER, booked, outcomeOfError } from './outcome';
import {
  type Lease,
  finishJob,
  releaseLease,
  renewLease,
  saveLogin,
} from './repository';
import { isWindowOver, resortNow } from './window';

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

export type RunnerOptions = {
  // Identifies this server instance in the jobs' leases.
  owner: string;
  leaseMs: number;
  pollIntervalMs: number;
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

// Describes an error for the log without repeating Disney's answer, which
// can name the guests.
function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof RequestError) {
    return {
      errorName: error.name,
      status: error.response.status,
    };
  }

  if (error instanceof Error) {
    return {
      errorName: error.name,
      stack: error.stack,
    };
  }

  return {
    errorName: 'unknown',
  };
}

// Runs one job from the moment it is claimed until it ends or is handed
// back.
class JobRun {
  private readonly controller = new AbortController();
  private readonly lease: Lease;
  private readonly progress: JobProgress;
  private readonly log;
  private readonly fetch: typeof fetch | undefined;

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
    this.fetch =
      options.proxyUrls.length > 0
        ? proxiedFetch(options.proxyUrls)
        : undefined;
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

    const ending = await this.search();

    await this.conclude(ending);
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
        outcome: booked(await this.autoBook(session)),
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

      try {
        await this.checkpoint(session);
        await this.heartbeat();
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
