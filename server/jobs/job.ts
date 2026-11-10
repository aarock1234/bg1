import { z } from 'zod';

import { RESORT_IDS } from '@/api/resort';

import { pushSubscriptionSchema } from '../push/notify';

export const JobStatus = {
  SEARCHING: 'searching',
  BOOKED: 'booked',

  // A return time in range came up, for the guest to book themselves.
  AVAILABLE: 'available',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

// Why a job ended without a booking. The codes are part of the API: the app
// decides what to show from them, so they must not change.
export const FailureCode = {
  // The job failed: searching on would not have helped.
  NO_ELIGIBLE_GUESTS: 'no_eligible_guests',
  CONNECTION_LOST: 'connection_lost',
  MODIFY_NOT_ALLOWED: 'modify_not_allowed',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  LOGIN_REJECTED: 'login_rejected',
  DISNEY_REQUEST_FAILED: 'disney_request_failed',
  UNKNOWN_ERROR: 'unknown_error',

  // The job expired: it ran out of time.
  LOGIN_EXPIRED: 'login_expired',
  WINDOW_OVER: 'window_over',
} as const;

export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

// A park date, as YYYY-MM-DD.
export const dateSchema = z.string().regex(DATE_PATTERN, {
  error: 'must be a date written as YYYY-MM-DD',
});

// A time on the resort's clock, as HH:MM:SS.
export const timeSchema = z.string().regex(TIME_PATTERN, {
  error: 'must be a time written as HH:MM:SS',
});

// A guest to book for, as the app's Lightning Lane client describes them.
// Only the fields the server uses are checked; the rest travel along
// untouched, because Disney's booking requests are built from the whole
// guest.
export const jobGuestSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),

  // Walt Disney World's booking request needs this for each guest. Disney
  // may send null where there is none, which is stored as absent.
  orderDetails: z
    .looseObject({
      externalIdentifier: z.looseObject({
        id: z.string(),
        idType: z.string(),
      }),
      orderId: z.string(),
      orderItemId: z.string(),
    })
    .nullish()
    .transform(orderDetails => orderDetails ?? undefined),
});

export type JobGuest = z.infer<typeof jobGuestSchema>;

// The latest check that didn't end in a booking.
export const lastAttemptSchema = z.object({
  kind: z.enum([
    'unavailable',
    'party-incomplete',
    'outside-range',
    'interrupted',
  ]),

  // The return time Disney offered, when it was outside the wanted range.
  offeredTime: timeSchema.optional(),
  at: z.iso.datetime(),
});

export type LastAttempt = z.infer<typeof lastAttemptSchema>;

// The Lightning Lane a job booked, or found available. The times are on the
// resort's clock, as YYYY-MM-DDTHH:MM:SS.
export const bookingResultSchema = z.object({
  experienceName: z.string(),
  start: z.string(),
  end: z.string(),
  guestNames: z.array(z.string()),
});

export type BookingResult = z.infer<typeof bookingResultSchema>;

export type JobFailure = {
  code: FailureCode;
  message: string;
};

// A row of the jobs table. Every row read from the database is parsed with
// this before it is used.
export const jobSchema = z.object({
  id: z.uuid(),
  tokenHash: z.string(),
  status: z.enum(JobStatus),
  resortId: z.enum(RESORT_IDS),
  experienceId: z.string(),
  experienceName: z.string(),
  guests: z.array(jobGuestSchema),
  bookingDate: dateSchema,
  earliest: timeSchema,
  latest: timeSchema,
  rollingWaitMinutes: z.number().int().positive().nullable(),
  encryptedLogin: z.string().nullable(),
  loginExpiresAt: z.date(),
  attemptCount: z.number().int().nonnegative(),
  lastAttempt: lastAttemptSchema.nullable(),
  result: bookingResultSchema.nullable(),
  failureCode: z.enum(FailureCode).nullable(),
  failureMessage: z.string().nullable(),
  pushSubscription: pushSubscriptionSchema.nullable(),
  leaseOwner: z.string().nullable(),
  leaseExpiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  finishedAt: z.date().nullable(),
});

export type Job = z.infer<typeof jobSchema>;

// How far a search has come: what a running job reports while it works.
export type JobProgress = Pick<Job, 'attemptCount' | 'lastAttempt'>;

// How a search ended.
export type JobOutcome =
  | {
      status: typeof JobStatus.BOOKED | typeof JobStatus.AVAILABLE;
      result: BookingResult;
    }
  | {
      status: typeof JobStatus.FAILED | typeof JobStatus.EXPIRED;
      failure: JobFailure;
    };
