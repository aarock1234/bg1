import type { Job, JobFailure } from './job';

// What the API tells a job's owner about it. The login, the token hash, and
// the push subscription never leave the server.
export type JobView = Pick<
  Job,
  | 'id'
  | 'status'
  | 'resortId'
  | 'experienceId'
  | 'experienceName'
  | 'earliest'
  | 'latest'
  | 'lastAttempt'
  | 'result'
> & {
  guestNames: string[];

  // The park date the search books for, as YYYY-MM-DD.
  date: string;

  // How many checks the search has made.
  attempts: number;
  failure: JobFailure | null;

  // ISO 8601 timestamps.
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

function failureOf(job: Job): JobFailure | null {
  if (job.failureCode === null) {
    return null;
  }

  return {
    code: job.failureCode,
    message: job.failureMessage ?? '',
  };
}

export function toJobView(job: Job): JobView {
  return {
    id: job.id,
    status: job.status,
    resortId: job.resortId,
    experienceId: job.experienceId,
    experienceName: job.experienceName,
    guestNames: job.guests.map(guest => guest.name),
    date: job.bookingDate,
    earliest: job.earliest,
    latest: job.latest,
    attempts: job.attemptCount,
    lastAttempt: job.lastAttempt,
    result: job.result,
    failure: failureOf(job),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}
