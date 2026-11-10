import { ReauthNeeded } from '@/api/auth';
import { RequestError } from '@/api/client';
import { type Guests, type LLMP, ModifyNotAllowed } from '@/api/ll';
import { NoEligibleGuests } from '@/api/ll/auto-book';
import type { ParkTime } from '@/datetime';
import { RateLimitExceeded } from '@/ratelimit';

import {
  FailureCode,
  type Job,
  type JobFailure,
  type JobOutcome,
  JobStatus,
} from './job';

const STATUS_UNAUTHORIZED = 401;

type UnsuccessfulOutcome = Extract<
  JobOutcome,
  {
    failure: JobFailure;
  }
>;

function failed(code: FailureCode, message: string): UnsuccessfulOutcome {
  return {
    status: JobStatus.FAILED,
    failure: {
      code,
      message,
    },
  };
}

export function booked(booking: LLMP): JobOutcome {
  return {
    status: JobStatus.BOOKED,
    result: {
      experienceName: booking.name,
      start: booking.start.toString(),
      end: booking.end.toString(),
      guestNames: booking.guests.map(guest => guest.name),
    },
  };
}

// A return time in range came up. Disney says nothing about how long it
// lasts, so the window's end is left as its start.
export function available(
  job: Pick<Job, 'experienceName' | 'bookingDate' | 'guests'>,
  time: ParkTime
): JobOutcome {
  const start = `${job.bookingDate}T${time.toString()}`;

  return {
    status: JobStatus.AVAILABLE,
    result: {
      experienceName: job.experienceName,
      start,
      end: start,
      guestNames: job.guests.map(guest => guest.name),
    },
  };
}

export const LOGIN_EXPIRED: UnsuccessfulOutcome = {
  status: JobStatus.EXPIRED,
  failure: {
    code: FailureCode.LOGIN_EXPIRED,
    message: 'Your Disney login expired before a Lightning Lane was found.',
  },
};

export const WINDOW_OVER: UnsuccessfulOutcome = {
  status: JobStatus.EXPIRED,
  failure: {
    code: FailureCode.WINDOW_OVER,
    message: 'No Lightning Lane came up within your return times.',
  },
};

// A party that has reached the experience's limit most likely holds the
// Lightning Lane already: a booking can go through without its answer ever
// arriving, after which nobody is eligible anymore.
function noEligibleGuestsMessage(guests: Guests): string {
  const hasReachedLimit = guests.ineligible.some(guest => {
    return guest.ineligibleReason === 'EXPERIENCE_LIMIT_REACHED';
  });

  if (hasReachedLimit) {
    return 'Your party can no longer book this Lightning Lane. Check your plans: it may already be booked.';
  }

  return 'Nobody in your party can book this Lightning Lane anymore.';
}

// Turns the error that stopped a search into the outcome the guest is told
// about. The messages are shown as they are, so they say nothing technical.
export function outcomeOfError(error: unknown): UnsuccessfulOutcome {
  if (error instanceof NoEligibleGuests) {
    return failed(
      FailureCode.NO_ELIGIBLE_GUESTS,
      noEligibleGuestsMessage(error.guests)
    );
  }

  if (error instanceof ModifyNotAllowed) {
    return failed(
      FailureCode.MODIFY_NOT_ALLOWED,
      'This Lightning Lane can no longer be changed.'
    );
  }

  if (error instanceof RateLimitExceeded) {
    return failed(
      FailureCode.RATE_LIMIT_EXCEEDED,
      'The search made too many requests and was stopped.'
    );
  }

  if (error instanceof ReauthNeeded) {
    return LOGIN_EXPIRED;
  }

  if (error instanceof RequestError) {
    return outcomeOfRejectedRequest(error.response.status);
  }

  return failed(
    FailureCode.UNKNOWN_ERROR,
    'Something unexpected went wrong and the search was stopped.'
  );
}

function outcomeOfRejectedRequest(status: number): UnsuccessfulOutcome {
  if (status === STATUS_UNAUTHORIZED) {
    return failed(
      FailureCode.LOGIN_REJECTED,
      'Disney no longer accepts your login. Log in again to search.'
    );
  }

  return failed(
    FailureCode.DISNEY_REQUEST_FAILED,
    `Disney refused the request (status ${status}).`
  );
}
