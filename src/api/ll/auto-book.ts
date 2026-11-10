import { ParkTime } from '@/datetime';

import { RequestError } from '../client';
import { OfferError } from '../ll';
import type {
  Guest,
  Guests,
  LLClient,
  LLMP,
  OfferExperience,
  OfferOptions,
} from '../ll';
import { bookForGuests } from './booking';

// How long to wait between checks. Each check makes up to three requests, and
// the client refuses everything once it makes more than five in one second.
const POLL_INTERVAL_MS = 1000;

const MAX_BACKOFF_MS = 30_000;

// How many checks in a row may fail on connection trouble before giving up.
const MAX_CONSECUTIVE_FAILURES = 8;

const STATUS_NETWORK_FAILURE = 0;
const STATUS_FORBIDDEN = 403;
const STATUS_GONE = 410;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_SERVER_ERROR = 500;

// The return times the guest is willing to accept, both ends included.
export type ReturnTimeRange = {
  earliest: ParkTime;
  latest: ParkTime;
};

// Why a check didn't end in a booking: Disney had no return time to offer,
// offered one outside the range, or couldn't be reached.
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

export class ConnectionLost extends Error {
  readonly name = 'ConnectionLost';

  constructor() {
    super('Too many consecutive requests failed');
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

// A failure worth retrying: a dropped connection, a rejected bot-protection
// token (the client fetches a new one), throttling, or a server error.
function isTransient(error: unknown): boolean {
  const status = requestStatus(error);

  if (status === undefined) {
    return false;
  }

  return (
    status === STATUS_NETWORK_FAILURE ||
    status === STATUS_FORBIDDEN ||
    status === STATUS_TOO_MANY_REQUESTS ||
    status >= STATUS_SERVER_ERROR
  );
}

function hasNoEligibleGuests(guests: Guests): boolean {
  return guests.eligible.length === 0 && guests.ineligible.length > 0;
}

// Doubles the wait after each consecutive failure, with jitter so retries
// don't land in step with anyone else's.
function retryDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures === 0) {
    return POLL_INTERVAL_MS;
  }

  const ceilingMs = Math.min(
    POLL_INTERVAL_MS * 2 ** consecutiveFailures,
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

    if (isTransient(error)) {
      return {
        kind: 'interrupted',
      };
    }

    throw error;
  }
}

// Keeps requesting an offer until one falls within the range, then books it.
// Rejects with the signal's reason when aborted, and with the error when a
// check fails in a way that retrying can't fix.
export async function autoBook(request: AutoBookRequest): Promise<LLMP> {
  const { signal, onAttempt } = request;
  let consecutiveFailures = 0;

  while (true) {
    signal.throwIfAborted();

    const result = await attemptBooking(request);

    if (result.kind === 'booked') {
      return result.booking;
    }

    consecutiveFailures =
      result.kind === 'interrupted' ? consecutiveFailures + 1 : 0;

    if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
      throw new ConnectionLost();
    }

    const retryInMs = retryDelayMs(consecutiveFailures);

    onAttempt?.({
      ...result,
      retryInMs,
    });

    await wait(retryInMs, signal);
  }
}
