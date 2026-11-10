import { ReauthNeeded } from '@/api/auth';
import { RequestError } from '@/api/client';
import { type LLMP, ModifyNotAllowed } from '@/api/ll';
import { ConnectionLost, NoEligibleGuests } from '@/api/ll/auto-book';
import { RateLimitExceeded } from '@/ratelimit';

import { FailureCode, type JobOutcome, JobStatus } from './job';

const STATUS_UNAUTHORIZED = 401;

type UnsuccessfulOutcome = Exclude<
  JobOutcome,
  {
    status: typeof JobStatus.BOOKED;
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

// Turns the error that stopped a search into the outcome the guest is told
// about. The messages are shown as they are, so they say nothing technical.
export function outcomeOfError(error: unknown): UnsuccessfulOutcome {
  if (error instanceof NoEligibleGuests) {
    return failed(
      FailureCode.NO_ELIGIBLE_GUESTS,
      'Nobody in your party can book this Lightning Lane anymore.'
    );
  }

  if (error instanceof ConnectionLost) {
    return failed(
      FailureCode.CONNECTION_LOST,
      'Disney stopped answering, so the search was stopped.'
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
