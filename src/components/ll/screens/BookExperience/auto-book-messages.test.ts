import { type JobView, ServerRequestFailed } from '@/api/bg1-server';

import {
  attemptMessage,
  bookedMessage,
  rejectionMessage,
} from './auto-book-messages';

type LastAttempt = NonNullable<JobView['lastAttempt']>;

type AttemptWording = {
  kind: LastAttempt['kind'];
  message: string;
};

type RejectionWording = {
  code: string;
  message: string;
};

const STATUS_UNREACHABLE = 0;
const STATUS_UNPROCESSABLE = 422;
const STATUS_SERVER_ERROR = 500;

const CHECKED_AT = '2021-10-01T14:05:00.000Z';

const UNREACHABLE_MESSAGE =
  "BG1's server couldn't be reached. Try again in a moment.";
const REFUSED_MESSAGE =
  "BG1's server couldn't take that. Try again in a moment.";

describe('attemptMessage()', () => {
  it.each<AttemptWording>([
    {
      kind: 'unavailable',
      message: 'No return times are available yet.',
    },
    {
      kind: 'party-incomplete',
      message: "Disney's offer didn't include everyone in your party.",
    },
    {
      kind: 'outside-range',
      message: 'The return time offered was outside your range.',
    },
    {
      kind: 'interrupted',
      message: "Couldn't reach Disney. Trying again.",
    },
  ])('describes a check that was $kind', ({ kind, message }) => {
    const attempt: LastAttempt = {
      kind,
      at: CHECKED_AT,
    };

    expect(attemptMessage(attempt)).toBe(message);
  });

  it('names the return time that was offered outside the range', () => {
    const attempt: LastAttempt = {
      kind: 'outside-range',
      offeredTime: '15:15:00',
      at: CHECKED_AT,
    };

    expect(attemptMessage(attempt)).toBe(
      'The latest return time offered was 3:15 PM, outside your range.'
    );
  });
});

describe('rejectionMessage()', () => {
  it.each<RejectionWording>([
    {
      code: 'login_expired',
      message: 'Your Disney login has expired. Sign in again to start.',
    },
    {
      code: 'invalid_time_range',
      message: 'The latest time has to be after the earliest.',
    },
    {
      code: 'window_over',
      message: 'That time range is already over.',
    },
    {
      code: 'date_not_bookable',
      message: "Auto booking isn't available for that date.",
    },
    {
      code: 'unknown_experience',
      message:
        "BG1's server doesn't know this experience yet. Try again later.",
    },
    {
      code: 'too_many_guests',
      message: 'That party is too large to book at once.',
    },
  ])('explains a search turned down as $code', ({ code, message }) => {
    const error = new ServerRequestFailed(STATUS_UNPROCESSABLE, code);

    expect(rejectionMessage(error)).toBe(message);
  });

  it('says the server could not be reached when no answer came', () => {
    const error = new ServerRequestFailed(STATUS_UNREACHABLE);

    expect(rejectionMessage(error)).toBe(UNREACHABLE_MESSAGE);
  });

  it('says the server could not take the search when it gives an unknown code', () => {
    const error = new ServerRequestFailed(STATUS_UNPROCESSABLE, 'a_new_code');

    expect(rejectionMessage(error)).toBe(REFUSED_MESSAGE);
  });

  it('says the server could not take the search when it gives no code', () => {
    const error = new ServerRequestFailed(STATUS_SERVER_ERROR);

    expect(rejectionMessage(error)).toBe(REFUSED_MESSAGE);
  });

  it('words an unreachable server and an unknown code differently', () => {
    const unreachable = new ServerRequestFailed(STATUS_UNREACHABLE);
    const unknownCode = new ServerRequestFailed(
      STATUS_UNPROCESSABLE,
      'a_new_code'
    );

    expect(rejectionMessage(unreachable)).not.toBe(
      rejectionMessage(unknownCode)
    );
  });

  it('does not blame the server for an error that is not its answer', () => {
    expect(rejectionMessage(new TypeError('something broke'))).toBe(
      'Something unexpected went wrong.'
    );
  });
});

describe('bookedMessage()', () => {
  it('names the experience and when to return', () => {
    const message = bookedMessage({
      experienceName: 'Space Mountain',
      start: '2021-10-01T15:15:00',
      end: '2021-10-01T16:15:00',
      guestNames: ['Mickey Mouse'],
    });

    expect(message).toBe('Space Mountain at 3:15 PM');
  });
});
