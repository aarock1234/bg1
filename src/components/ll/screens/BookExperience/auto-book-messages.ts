import { JobView, ServerRequestFailed } from '@/api/bg1-server';
import { formatTime } from '@/datetime';

type LastAttempt = NonNullable<JobView['lastAttempt']>;

// What to tell the guest when the server turns a search down, by the code it
// gives for the reason.
const REJECTION_MESSAGES: Record<string, string> = {
  login_expired: 'Your Disney login has expired. Sign in again to start.',
  invalid_time_range: 'The latest time has to be after the earliest.',
  window_over: 'That time range is already over.',
  date_not_bookable: "Auto booking isn't available for that date.",
  unknown_experience:
    "BG1's server doesn't know this experience yet. Try again later.",
  too_many_guests: 'That party is too large to book at once.',
};

// The status of a request that never got an answer from the server.
const STATUS_UNREACHABLE = 0;

// Describes why the server's latest check didn't book anything.
export function attemptMessage(attempt: LastAttempt): string {
  switch (attempt.kind) {
    case 'unavailable':
      return 'No return times are available yet.';
    case 'party-incomplete':
      return "Disney's offer didn't include everyone in your party.";
    case 'outside-range':
      return attempt.offeredTime
        ? `The latest return time offered was ${formatTime(attempt.offeredTime)}, outside your range.`
        : 'The return time offered was outside your range.';
    case 'interrupted':
      return "Couldn't reach Disney. Trying again.";
    default: {
      const unhandled: never = attempt.kind;

      throw new Error(`unhandled attempt: ${String(unhandled)}`);
    }
  }
}

// Describes why a search couldn't be handed to the server or stopped.
export function rejectionMessage(error: unknown): string {
  if (!(error instanceof ServerRequestFailed)) {
    return 'Something unexpected went wrong.';
  }

  const message = error.code ? REJECTION_MESSAGES[error.code] : undefined;

  if (message) {
    return message;
  }

  if (error.status === STATUS_UNREACHABLE) {
    return "BG1's server couldn't be reached. Try again in a moment.";
  }

  return "BG1's server couldn't take that. Try again in a moment.";
}

// Describes the Lightning Lane a search booked, such as "Space Mountain at
// 3:15 PM".
export function bookedMessage(result: NonNullable<JobView['result']>): string {
  const [, startTime = ''] = result.start.split('T');

  return `${result.experienceName} at ${formatTime(startTime)}`;
}
