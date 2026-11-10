import { ReauthNeeded } from '@/api/auth';
import { RequestError } from '@/api/client';
import { ModifyNotAllowed } from '@/api/ll';
import {
  AutoBookAttempt,
  ConnectionLost,
  NoEligibleGuests,
} from '@/api/ll/auto-book';
import { formatTime } from '@/datetime';
import { RateLimitExceeded } from '@/ratelimit';

const MS_PER_SECOND = 1000;

// Describes why the latest check didn't book anything.
export function attemptMessage(attempt: AutoBookAttempt): string {
  switch (attempt.kind) {
    case 'unavailable':
      return 'No return times are available yet.';
    case 'outside-range':
      return `The latest return time offered was ${formatTime(attempt.offeredTime)}, outside your range.`;
    case 'interrupted': {
      const seconds = Math.ceil(attempt.retryInMs / MS_PER_SECOND);

      return `Couldn't reach Disney. Trying again in ${seconds} seconds.`;
    }
    default: {
      const unhandled: never = attempt;

      throw new Error(`unhandled attempt: ${JSON.stringify(unhandled)}`);
    }
  }
}

// Describes why auto booking stopped on its own.
export function failureMessage(error: unknown): string {
  if (error instanceof NoEligibleGuests) {
    return 'No one in your party is eligible for this Lightning Lane anymore.';
  }

  if (error instanceof ModifyNotAllowed) {
    return 'Your current reservation can no longer be modified.';
  }

  if (error instanceof ReauthNeeded) {
    return 'Your Disney login expired. Log in again to keep looking.';
  }

  if (error instanceof RateLimitExceeded) {
    return 'BG1 made too many requests at once. Reload the page to continue.';
  }

  if (error instanceof ConnectionLost) {
    return "Disney couldn't be reached. Check your connection and start again.";
  }

  if (error instanceof RequestError) {
    return `Disney rejected the request (status ${error.response.status}).`;
  }

  return 'Something unexpected went wrong.';
}
