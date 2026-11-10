import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from '../db/client';
import { jobs } from '../db/schema';
import {
  type Job,
  type JobOutcome,
  type JobProgress,
  JobStatus,
  jobSchema,
} from './job';

const MS_PER_SECOND = 1000;

// What a new job is created from. The database fills in the rest.
export type NewJob = Pick<
  Job,
  | 'tokenHash'
  | 'resortId'
  | 'experienceId'
  | 'experienceName'
  | 'guests'
  | 'bookingDate'
  | 'earliest'
  | 'latest'
  | 'loginExpiresAt'
  | 'pushSubscription'
> & {
  encryptedLogin: string;
};

// The claim one server instance holds on a job it is running.
export type Lease = {
  jobId: string;
  owner: string;
};

export type ClaimRequest = {
  owner: string;
  leaseMs: number;
  limit: number;
};

// The jobs a claim obtained. A row that fails validation can't be run; its ID
// is reported so the caller can end it.
export type ClaimedJobs = {
  jobs: Job[];
  unreadableJobIds: string[];
};

export type LeaseRenewal = Lease & {
  leaseMs: number;
  progress: JobProgress;
};

export type LoginUpdate = Lease &
  Pick<Job, 'loginExpiresAt'> & {
    encryptedLogin: string;
  };

export type JobEnding = Lease & {
  outcome: JobOutcome;
  progress?: JobProgress;
};

// The database's clock decides when leases expire, so that instances whose
// clocks differ still agree.
const NOW = sql`now()`;

function leaseExpiry(leaseMs: number) {
  return sql`now() + make_interval(secs => ${leaseMs / MS_PER_SECOND})`;
}

// What every ending writes: the login and the push subscription are no longer
// needed, so they are deleted, and the lease is given up.
const ENDED = {
  encryptedLogin: null,
  pushSubscription: null,
  leaseOwner: null,
  leaseExpiresAt: null,
  finishedAt: NOW,
  updatedAt: NOW,
};

function holdsLease(lease: Lease) {
  return and(
    eq(jobs.id, lease.jobId),
    eq(jobs.leaseOwner, lease.owner),
    eq(jobs.status, JobStatus.SEARCHING)
  );
}

export async function insertJob(newJob: NewJob): Promise<Job> {
  const [row] = await db
    .insert(jobs)
    .values({
      ...newJob,
      status: JobStatus.SEARCHING,
    })
    .returning();

  return jobSchema.parse(row);
}

export async function findJob(id: string): Promise<Job | undefined> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));

  if (!row) {
    return undefined;
  }

  return jobSchema.parse(row);
}

// Takes over searching jobs that no instance holds: new ones, released ones,
// and ones whose instance stopped renewing its lease. Rows another instance
// is claiming at the same moment are skipped, so a job is never claimed
// twice.
export async function claimJobs(request: ClaimRequest): Promise<ClaimedJobs> {
  const claimable = db
    .select({
      id: jobs.id,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, JobStatus.SEARCHING),
        or(isNull(jobs.leaseOwner), lt(jobs.leaseExpiresAt, NOW))
      )
    )
    .orderBy(jobs.createdAt)
    .limit(request.limit)
    .for('update', {
      skipLocked: true,
    });

  const rows = await db
    .update(jobs)
    .set({
      leaseOwner: request.owner,
      leaseExpiresAt: leaseExpiry(request.leaseMs),
      updatedAt: NOW,
    })
    .where(inArray(jobs.id, claimable))
    .returning();

  const claimed: ClaimedJobs = {
    jobs: [],
    unreadableJobIds: [],
  };

  for (const row of rows) {
    const job = jobSchema.safeParse(row);

    if (job.success) {
      claimed.jobs.push(job.data);
    } else {
      claimed.unreadableJobIds.push(row.id);
    }
  }

  return claimed;
}

// Extends a lease and saves the search's progress. Returns false when the
// job is no longer this owner's to run: it was cancelled, or another instance
// took it over.
export async function renewLease(renewal: LeaseRenewal): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({
      ...renewal.progress,
      leaseExpiresAt: leaseExpiry(renewal.leaseMs),
      updatedAt: NOW,
    })
    .where(holdsLease(renewal))
    .returning({
      id: jobs.id,
    });

  return rows.length > 0;
}

// Gives a job up without ending it, so that another instance can continue
// the search at once.
export async function releaseLease(
  lease: Lease,
  progress: JobProgress
): Promise<void> {
  await db
    .update(jobs)
    .set({
      ...progress,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: NOW,
    })
    .where(holdsLease(lease));
}

// Replaces a job's login with a refreshed one.
export async function saveLogin(update: LoginUpdate): Promise<void> {
  await db
    .update(jobs)
    .set({
      encryptedLogin: update.encryptedLogin,
      loginExpiresAt: update.loginExpiresAt,
      updatedAt: NOW,
    })
    .where(holdsLease(update));
}

// Records how a search ended. Returns false when nothing was recorded because
// the job had already ended or belongs to another instance.
//
// A booking is recorded even then, unless a result is already stored: the
// Lightning Lane exists, whatever happened to the job in the meantime.
export async function finishJob(ending: JobEnding): Promise<boolean> {
  const { outcome } = ending;
  const isBooked = outcome.status === JobStatus.BOOKED;

  const rows = await db
    .update(jobs)
    .set({
      ...ending.progress,
      ...ENDED,
      status: outcome.status,
      result: isBooked ? outcome.result : null,
      failureCode: isBooked ? null : outcome.failure.code,
      failureMessage: isBooked ? null : outcome.failure.message,
    })
    .where(
      isBooked
        ? and(eq(jobs.id, ending.jobId), isNull(jobs.result))
        : holdsLease(ending)
    )
    .returning({
      id: jobs.id,
    });

  return rows.length > 0;
}

// Ends a search at the guest's request. Returns the job as it is afterward,
// whether or not it was still searching.
export async function cancelJob(id: string): Promise<Job | undefined> {
  const [row] = await db
    .update(jobs)
    .set({
      ...ENDED,
      status: JobStatus.CANCELLED,
    })
    .where(and(eq(jobs.id, id), eq(jobs.status, JobStatus.SEARCHING)))
    .returning();

  if (!row) {
    return findJob(id);
  }

  return jobSchema.parse(row);
}

// Deletes the jobs that ended longer ago than the given time and returns how
// many there were. A finished job still names its guests, which nothing
// needs once the app has shown how the search ended.
export async function deleteFinishedJobs(olderThanMs: number): Promise<number> {
  const rows = await db
    .delete(jobs)
    .where(
      lt(
        jobs.finishedAt,
        sql`now() - make_interval(secs => ${olderThanMs / MS_PER_SECOND})`
      )
    )
    .returning({
      id: jobs.id,
    });

  return rows.length;
}
