import { ParkTime } from '@/datetime';
import { RateLimitExceeded } from '@/ratelimit';

import { ReauthNeeded } from '../auth';
import { RequestError } from '../client';
import { ModifyNotAllowed, OfferError } from '../ll';
import type {
  Guest,
  Guests,
  LLClient,
  LLMP,
  OfferExperience,
  OfferOptions,
} from '../ll';
import { bookForGuests } from './booking';

// How long to wait between checks unless the request says otherwise. A
// client's default rate limit allows this pace; a faster one needs a higher
// limit.
const DEFAULT_POLL_INTERVAL_MS = 1000;

// The longest wait between two checks while checks keep being interrupted.
const MAX_BACKOFF_MS = 30_000;

const STATUS_UNAUTHORIZED = 401;
const STATUS_GONE = 410;

// The return times the guest is willing to accept, both ends included.
export type ReturnTimeRange = {
  earliest: ParkTime;
  latest: ParkTime;
};

// Why a check didn't end in a booking: Disney had no return time to offer,
// offered one outside the range, or the check itself went wrong.
type Miss =
  | {
      kind: 'unavailable';
    }
  | {
      kind: 'outside-range';
      offeredTime: ParkTime;
    }
  | {
      kind: 'interrupted';

      // What interrupted the check, for whoever logs it.
      error: unknown;
    };

type Booked = {
  kind: 'booked';
  booking: LLMP;
};

// A check that didn't end in a booking, with how long until the next one.
export type AutoBookAttempt = Miss & {
  retryInMs: number;
};

export type AutoBookRequest = {
  ll: Pick<LLClient, 'offer' | 'book' | 'cancelBooking'>;
  experience: OfferExperience;
  guests: Guest[];
  range: ReturnTimeRange;

  // The date to book for, or the existing booking to modify.
  offerOptions: OfferOptions<LLMP | undefined>;

  // Stops the search. A booking request that is already on its way to Disney
  // can't be recalled, so a booking may still be returned after aborting.
  signal: AbortSignal;

  // How long to wait between checks. Whoever shortens it must give the
  // client a rate limit that allows the faster pace.
  pollIntervalMs?: number;

  onAttempt?: (attempt: AutoBookAttempt) => void;
};

// Nobody in the party can book the experience anymore, so no amount of
// waiting will produce an offer.
export class NoEligibleGuests extends Error {
  readonly name = 'NoEligibleGuests';

  constructor(readonly guests: Guests) {
    super('No eligible guests');
  }
}

function isWithinRange(time: ParkTime, range: ReturnTimeRange): boolean {
  return time >= range.earliest && time <= range.latest;
}

function requestStatus(error: unknown): number | undefined {
  if (error instanceof RequestError) {
    return error.response.status;
  }

  return undefined;
}

// Disney answers 410 when it has no return time to offer.
function isUnavailable(error: unknown): boolean {
  return error instanceof OfferError || requestStatus(error) === STATUS_GONE;
}

// A failure that checking again can't fix: Disney no longer accepts the
// login, the booking can't be changed, or the client refuses to send any more
// requests. Everything else is worth another try, whether it is a dropped
// connection, a rejected bot-protection token, throttling, or an answer
// nobody expected.
function isFinal(error: unknown): boolean {
  return (
    error instanceof ReauthNeeded ||
    error instanceof ModifyNotAllowed ||
    error instanceof RateLimitExceeded ||
    requestStatus(error) === STATUS_UNAUTHORIZED
  );
}

function hasNoEligibleGuests(guests: Guests): boolean {
  return guests.eligible.length === 0 && guests.ineligible.length > 0;
}

// Doubles the wait after each consecutive failure, with jitter so retries
// don't land in step with anyone else's.
function retryDelayMs(
  consecutiveFailures: number,
  pollIntervalMs: number
): number {
  if (consecutiveFailures === 0) {
    return pollIntervalMs;
  }

  const ceilingMs = Math.min(
    pollIntervalMs * 2 ** consecutiveFailures,
    MAX_BACKOFF_MS
  );
  const jitter = 0.5 + Math.random() / 2;

  return Math.round(ceilingMs * jitter);
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    function cancel(): void {
      clearTimeout(timeoutId);
      reject(signal.reason);
    }

    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);

    signal.addEventListener('abort', cancel, {
      once: true,
    });
  });
}

async function attemptBooking(
  request: AutoBookRequest
): Promise<Booked | Miss> {
  const { ll, experience, guests, range, offerOptions, signal } = request;

  try {
    const offer = await ll.offer(experience, guests, offerOptions);
    const offeredTime = offer.start.time;

    if (!isWithinRange(offeredTime, range)) {
      return {
        kind: 'outside-range',
        offeredTime,
      };
    }

    // The search may have been stopped while the offer was loading.
    signal.throwIfAborted();

    return {
      kind: 'booked',
      booking: await bookForGuests(ll, offer, guests),
    };
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    if (error instanceof OfferError && hasNoEligibleGuests(error.guests)) {
      throw new NoEligibleGuests(error.guests);
    }

    if (isUnavailable(error)) {
      return {
        kind: 'unavailable',
      };
    }

    if (isFinal(error)) {
      throw error;
    }

    return {
      kind: 'interrupted',
      error,
    };
  }
}

// Keeps requesting an offer until one falls within the range, then books it.
// A check that goes wrong is tried again, with a growing wait between tries,
// for as long as the caller lets the search run: there is no limit here on
// how often. Rejects with the signal's reason when aborted, and with the
// error when a check fails in a way that retrying can't fix.
export async function autoBook(request: AutoBookRequest): Promise<LLMP> {
  const {
    signal,
    onAttempt,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = request;
  let consecutiveFailures = 0;

  while (true) {
    signal.throwIfAborted();

    const result = await attemptBooking(request);

    if (result.kind === 'booked') {
      return result.booking;
    }

    consecutiveFailures =
      result.kind === 'interrupted' ? consecutiveFailures + 1 : 0;

    const retryInMs = retryDelayMs(consecutiveFailures, pollIntervalMs);

    onAttempt?.({
      ...result,
      retryInMs,
    });

    await wait(retryInMs, signal);
  }
}
