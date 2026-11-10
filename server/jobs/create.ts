import { z } from 'zod';

import { InvalidId, RESORT_IDS } from '@/api/resort';
import { modifyDate, parkDate } from '@/datetime';

import { llClientFor, resortFor } from '../disney/clients';
import { disneyLoginSchema, loginAuth } from '../disney/credentials';
import { encryptLogin } from '../disney/login-crypto';
import { pushSubscriptionSchema } from '../push/notify';
import { type Job, dateSchema, jobGuestSchema, timeSchema } from './job';
import { insertJob } from './repository';
import { newJobToken } from './token';
import {
  type BookingWindow,
  isRangeBackward,
  isWindowOver,
  resortNow,
} from './window';

// How far ahead a search may be set up. Disney opens Lightning Lanes days
// before a visit, not months.
const MAX_DAYS_AHEAD = 30;

// The largest party either resort books for, which bounds the request before
// the resort's own limit is checked.
const MAX_GUESTS = 20;

const MAX_EXPERIENCE_ID_LENGTH = 64;

export const createJobRequestSchema = z.object({
  resortId: z.enum(RESORT_IDS),
  login: disneyLoginSchema,
  experienceId: z.string().min(1).max(MAX_EXPERIENCE_ID_LENGTH),

  // The Lightning Lane guests to book for, as the app holds them.
  guests: z.array(jobGuestSchema).min(1).max(MAX_GUESTS),

  // The park date and the return times the guest accepts, on the resort's
  // clock.
  date: dateSchema,
  earliest: timeSchema,
  latest: timeSchema,

  // Where to send the notification when the search ends.
  pushSubscription: pushSubscriptionSchema.optional(),
});

export type CreateJobRequest = z.input<typeof createJobRequestSchema>;

type ValidJobRequest = z.output<typeof createJobRequestSchema>;

// Why a well-formed request for a job was turned down. The codes are part of
// the API.
export const RejectionCode = {
  LOGIN_EXPIRED: 'login_expired',
  INVALID_TIME_RANGE: 'invalid_time_range',
  WINDOW_OVER: 'window_over',
  DATE_NOT_BOOKABLE: 'date_not_bookable',
  UNKNOWN_EXPERIENCE: 'unknown_experience',
  TOO_MANY_GUESTS: 'too_many_guests',
} as const;

export type RejectionCode = (typeof RejectionCode)[keyof typeof RejectionCode];

export class JobRejected extends Error {
  readonly name = 'JobRejected';

  constructor(
    readonly code: RejectionCode,
    message: string
  ) {
    super(message);
  }
}

export type CreatedJob = {
  job: Job;

  // The secret that authorizes later requests about the job. It is returned
  // once and not stored.
  token: string;
};

function rejectUnusableLogin(request: ValidJobRequest): void {
  if (request.login.expires <= Date.now()) {
    throw new JobRejected(
      RejectionCode.LOGIN_EXPIRED,
      'Your Disney login has expired. Log in again to search.'
    );
  }
}

// Rejects a window nothing can be booked in. `canPrebook` says whether the
// resort books Lightning Lanes for dates after today.
function rejectUnbookableWindow(
  request: ValidJobRequest,
  window: BookingWindow,
  canPrebook: boolean
): void {
  const now = resortNow(request.resortId);
  const today = parkDate(now);

  if (isRangeBackward(window)) {
    throw new JobRejected(
      RejectionCode.INVALID_TIME_RANGE,
      'The latest return time is before the earliest.'
    );
  }

  if (isWindowOver(window, now)) {
    throw new JobRejected(
      RejectionCode.WINDOW_OVER,
      'Those return times have already passed.'
    );
  }

  if (window.bookingDate !== today && !canPrebook) {
    throw new JobRejected(
      RejectionCode.DATE_NOT_BOOKABLE,
      'This resort only books Lightning Lanes for today.'
    );
  }

  if (window.bookingDate > modifyDate(today, MAX_DAYS_AHEAD)) {
    throw new JobRejected(
      RejectionCode.DATE_NOT_BOOKABLE,
      `A search can start at most ${MAX_DAYS_AHEAD} days ahead.`
    );
  }
}

async function experienceName(request: ValidJobRequest): Promise<string> {
  const resort = await resortFor(request.resortId);

  try {
    return resort.experience(request.experienceId).name;
  } catch (error) {
    if (error instanceof InvalidId) {
      throw new JobRejected(
        RejectionCode.UNKNOWN_EXPERIENCE,
        'That experience is not one BG1 can book.'
      );
    }

    throw error;
  }
}

// Checks a request against the booking rules and stores it as a job for the
// worker to pick up. Throws JobRejected when a rule turns it down.
export async function createJob(request: ValidJobRequest): Promise<CreatedJob> {
  const { resortId, login, guests } = request;
  const window: BookingWindow = {
    bookingDate: request.date,
    earliest: request.earliest,
    latest: request.latest,
  };
  const { rules } = await llClientFor(resortId, loginAuth(login));

  rejectUnusableLogin(request);
  rejectUnbookableWindow(request, window, rules.prebook);

  if (guests.length > rules.maxPartySize) {
    throw new JobRejected(
      RejectionCode.TOO_MANY_GUESTS,
      `A party can have at most ${rules.maxPartySize} guests.`
    );
  }

  const name = await experienceName(request);
  const { token, hash } = newJobToken();
  const job = await insertJob({
    ...window,
    tokenHash: hash,
    resortId,
    experienceId: request.experienceId,
    experienceName: name,
    guests,
    encryptedLogin: encryptLogin(login),
    loginExpiresAt: new Date(login.expires),
    pushSubscription: request.pushSubscription ?? null,
  });

  return {
    job,
    token,
  };
}
