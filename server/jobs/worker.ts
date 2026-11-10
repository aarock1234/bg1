import { randomUUID } from 'node:crypto';

import { logger } from '../log';
import { FailureCode, JobStatus } from './job';
import { claimJobs, finishJob } from './repository';
import {
  type RunnerOptions,
  type RunningJob,
  StopReason,
  startJob,
} from './runner';

// How often to look for jobs nobody is running. Creating a job wakes the
// worker at once, so this only decides how soon a job is picked up after
// another instance let go of it.
const CLAIM_INTERVAL_MS = 5000;

// How long a claim on a job holds without being renewed. An instance that
// dies without releasing its jobs keeps them from being resumed for this
// long.
const LEASE_MS = 30_000;

// How many jobs one instance runs at a time.
const MAX_RUNNING_JOBS = 100;

export type WorkerOptions = Omit<RunnerOptions, 'owner' | 'leaseMs'>;

export type Worker = {
  // Looks for jobs to run without waiting for the next interval.
  wake(): void;

  // Stops the job at once if this instance is running it.
  cancel(jobId: string): void;

  // Stops claiming, hands every running job back for another instance to
  // continue, and resolves when all of them have been released.
  stop(): Promise<void>;
};

// Starts the worker that runs auto-book jobs inside this server. Several
// instances can run side by side: each job is leased to one of them at a
// time.
export function startWorker(options: WorkerOptions): Worker {
  const owner = randomUUID();
  const runnerOptions: RunnerOptions = {
    ...options,
    owner,
    leaseMs: LEASE_MS,
  };
  const runningJobs = new Map<string, RunningJob>();
  const shutdown = new AbortController();
  // A wake-up call that arrives during a claim is kept for the next wait, so
  // a job created at that moment isn't left until the interval is over.
  let isWakePending = false;
  let endWait: () => void = () => undefined;

  function wakeUp(): void {
    isWakePending = true;
    endWait();
  }

  // Waits until the next claim is due or the worker is woken.
  function nextClaim(): Promise<void> {
    if (isWakePending) {
      isWakePending = false;

      return Promise.resolve();
    }

    return new Promise(resolve => {
      function finishWait(): void {
        clearTimeout(timeoutId);
        endWait = () => undefined;
        isWakePending = false;
        resolve();
      }

      const timeoutId = setTimeout(finishWait, CLAIM_INTERVAL_MS);
      endWait = finishWait;
    });
  }

  // A row that can't be read can't be run either, so it is ended instead of
  // being claimed again and again.
  async function failUnreadableJob(jobId: string): Promise<void> {
    logger.error(
      {
        jobId,
      },
      'job row is unreadable'
    );

    await finishJob({
      jobId,
      owner,
      outcome: {
        status: JobStatus.FAILED,
        failure: {
          code: FailureCode.UNKNOWN_ERROR,
          message: 'The search could not be continued.',
        },
      },
    });
  }

  async function claimAvailableJobs(): Promise<void> {
    const capacity = MAX_RUNNING_JOBS - runningJobs.size;

    if (capacity <= 0) {
      return;
    }

    const claimed = await claimJobs({
      owner,
      leaseMs: LEASE_MS,
      limit: capacity,
    });

    for (const job of claimed.jobs) {
      const runningJob = startJob(job, runnerOptions);

      runningJobs.set(job.id, runningJob);

      // `done` never rejects, so this needs no failure handling of its own.
      void runningJob.done.then(() => runningJobs.delete(job.id));
    }

    for (const jobId of claimed.unreadableJobIds) {
      await failUnreadableJob(jobId);
    }
  }

  async function claimUntilShutdown(): Promise<void> {
    while (!shutdown.signal.aborted) {
      try {
        await claimAvailableJobs();
      } catch (error) {
        logger.error(
          {
            err: error,
          },
          'claiming jobs failed'
        );
      }

      // Shutdown may have begun during the claim, after its wake-up call.
      if (!shutdown.signal.aborted) {
        await nextClaim();
      }
    }
  }

  const claiming = claimUntilShutdown();

  logger.info(
    {
      owner,
    },
    'job worker started'
  );

  return {
    wake() {
      wakeUp();
    },

    cancel(jobId) {
      runningJobs.get(jobId)?.stop(StopReason.CANCELLED);
    },

    async stop() {
      shutdown.abort();
      wakeUp();
      await claiming;

      const stopping = [...runningJobs.values()].map(runningJob => {
        runningJob.stop(StopReason.SHUTDOWN);

        return runningJob.done;
      });

      await Promise.all(stopping);

      logger.info(
        {
          released: stopping.length,
        },
        'job worker stopped'
      );
    },
  };
}
