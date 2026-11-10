import { booking, hm, mickey, minnie, offer, pluto } from '@/__fixtures__/ll';
import { DateTime, ParkTime } from '@/datetime';
import { RateLimitExceeded } from '@/ratelimit';
import { TODAY } from '@/testing';

import { ReauthNeeded } from '../auth';
import { RequestError } from '../client';
import {
  type Guest,
  type IneligibleReason,
  type LLMP,
  ModifyNotAllowed,
  type Offer,
  OfferError,
} from '../ll';
import { SensorDataUnavailable } from '../sensor-data';
import {
  type AutoBookAttempt,
  type AutoBookRequest,
  NoEligibleGuests,
  type ReturnTimeRange,
  autoBook,
} from './auto-book';

const POLL_INTERVAL_MS = 1000;
const LONGEST_WAIT_MS = 30_000;

// What Math.random returns for the longest wait the jitter allows.
const LONGEST_JITTER = 1;

const STATUS_NETWORK_FAILURE = 0;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_GONE = 410;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_SERVICE_UNAVAILABLE = 503;

const STOPPED = new Error('the test stopped the search');

const party: Guest[] = [mickey, minnie, pluto];

const range: ReturnTimeRange = {
  earliest: ParkTime.from('11:00'),
  latest: ParkTime.from('12:00'),
};

type FakeLL = jest.Mocked<AutoBookRequest['ll']>;

type FakeLLOptions = {
  timeSelect: boolean;
};

type Search = {
  // Every miss the search has reported, oldest first.
  attempts: AutoBookAttempt[];
  controller: AbortController;
  result: Promise<LLMP>;
};

type FinalError = {
  cause: string;
  error: Error;
};

const NO_TIME_SELECTION: FakeLLOptions = {
  timeSelect: false,
};

const TIME_SELECTION: FakeLLOptions = {
  timeSelect: true,
};

// A client that books whatever it is asked to. Each test says what it offers.
function fakeLL(options: FakeLLOptions = NO_TIME_SELECTION): FakeLL {
  return {
    rules: {
      maxPartySize: 12,
      parkModify: false,
      prebook: false,
      timeSelect: options.timeSelect,
    },
    offer: jest.fn(),
    times: jest.fn(),
    changeOfferTime: jest.fn(),
    book: jest.fn().mockResolvedValue(booking),
    cancelBooking: jest.fn(),
  };
}

function offerAt(time: string): Offer<undefined> {
  const start = ParkTime.from(time);

  return {
    ...offer,
    start: new DateTime(TODAY, start),
    end: new DateTime(
      TODAY,
      start.add({
        hours: 1,
      })
    ),
  };
}

function requestError(status: number): RequestError {
  return new RequestError({
    ok: false,
    status,
    data: {},
  });
}

// Disney's answer when nobody in the party can be offered a return time.
function nobodyEligible(reason: IneligibleReason): OfferError {
  return new OfferError({
    eligible: [],
    ineligible: party.map(guest => {
      return {
        ...guest,
        ineligibleReason: reason,
      };
    }),
  });
}

function startSearch(ll: FakeLL): Search {
  const attempts: AutoBookAttempt[] = [];
  const controller = new AbortController();

  const result = autoBook({
    ll,
    experience: hm,
    guests: party,
    range,
    offerOptions: {
      date: TODAY,
    },
    signal: controller.signal,
    pollIntervalMs: POLL_INTERVAL_MS,
    onAttempt: attempt => attempts.push(attempt),
  });

  return {
    attempts,
    controller,
    result,
  };
}

// Lets the wait after the latest miss pass, so that the next check runs. The
// first call runs the first check.
async function nextCheck(search: Search): Promise<void> {
  const waitMs = search.attempts.at(-1)?.retryInMs ?? 0;

  await jest.advanceTimersByTimeAsync(waitMs);
}

// Ends a search that would otherwise keep checking forever.
async function stopSearch(search: Search): Promise<void> {
  search.controller.abort(STOPPED);

  await expect(search.result).rejects.toBe(STOPPED);
}

beforeEach(() => {
  jest.useFakeTimers({
    advanceTimers: false,
  });
  jest.spyOn(Math, 'random').mockReturnValue(LONGEST_JITTER);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('autoBook()', () => {
  describe('the return time range', () => {
    it.each(['11:00', '11:30', '12:00'])(
      'books an offer for %s, which is inside the range',
      async time => {
        const ll = fakeLL();
        const offered = offerAt(time);
        ll.offer.mockResolvedValue(offered);

        const search = startSearch(ll);
        await nextCheck(search);

        await expect(search.result).resolves.toBe(booking);
        expect(ll.offer).toHaveBeenCalledWith(hm, party, {
          date: TODAY,
        });
        expect(ll.book).toHaveBeenCalledWith(offered, party);
        expect(search.attempts).toEqual([]);
      }
    );

    it.each(['10:59', '12:01'])(
      'does not book an offer for %s, which is outside the range',
      async time => {
        const ll = fakeLL();
        ll.offer.mockResolvedValue(offerAt(time));

        const search = startSearch(ll);
        await nextCheck(search);

        expect(search.attempts).toEqual([
          {
            kind: 'outside-range',
            offeredTime: ParkTime.from(time),
            retryInMs: POLL_INTERVAL_MS,
          },
        ]);
        expect(ll.book).not.toHaveBeenCalled();

        await stopSearch(search);
      }
    );
  });

  describe('a check that finds nothing to book', () => {
    it('reports Disney answering 410 as unavailable and keeps searching', async () => {
      const ll = fakeLL();
      ll.offer
        .mockRejectedValueOnce(requestError(STATUS_GONE))
        .mockResolvedValueOnce(offerAt('11:30'));

      const search = startSearch(ll);
      await nextCheck(search);
      await nextCheck(search);

      await expect(search.result).resolves.toBe(booking);
      expect(search.attempts).toEqual([
        {
          kind: 'unavailable',
          retryInMs: POLL_INTERVAL_MS,
        },
      ]);
    });

    it('does not book an offer that leaves out a requested guest', async () => {
      const ll = fakeLL();
      ll.offer.mockResolvedValue({
        ...offerAt('11:30'),
        guests: {
          eligible: [mickey, minnie],
          ineligible: [
            {
              ...pluto,
              ineligibleReason: 'EXPERIENCE_LIMIT_REACHED',
            },
          ],
        },
      });

      const search = startSearch(ll);
      await nextCheck(search);

      expect(search.attempts).toEqual([
        {
          kind: 'party-incomplete',
          retryInMs: POLL_INTERVAL_MS,
        },
      ]);
      expect(ll.book).not.toHaveBeenCalled();

      await stopSearch(search);
    });

    it.each<IneligibleReason>([
      'TOO_EARLY',
      'TOO_EARLY_FOR_PARK_HOPPING',
      'TOO_EARLY_FOR_NEXT_PARK',
    ])(
      'keeps searching while the whole party is ineligible for %s',
      async reason => {
        const ll = fakeLL();
        ll.offer
          .mockRejectedValueOnce(nobodyEligible(reason))
          .mockResolvedValueOnce(offerAt('11:30'));

        const search = startSearch(ll);
        await nextCheck(search);
        await nextCheck(search);

        await expect(search.result).resolves.toBe(booking);
        expect(search.attempts).toEqual([
          {
            kind: 'unavailable',
            retryInMs: POLL_INTERVAL_MS,
          },
        ]);
      }
    );

    it('ends when the whole party has reached the experience limit', async () => {
      const ll = fakeLL();
      const limitReached = nobodyEligible('EXPERIENCE_LIMIT_REACHED');
      ll.offer.mockRejectedValue(limitReached);

      const search = startSearch(ll);

      await expect(search.result).rejects.toEqual(
        new NoEligibleGuests(limitReached.guests)
      );
      expect(ll.offer).toHaveBeenCalledTimes(1);
      expect(search.attempts).toEqual([]);
    });
  });

  describe('a check that goes wrong', () => {
    it('tries again after the bot-protection token could not be fetched', async () => {
      const ll = fakeLL();
      const tokenFailure = new SensorDataUnavailable();
      ll.offer
        .mockRejectedValueOnce(tokenFailure)
        .mockResolvedValueOnce(offerAt('11:30'));

      const search = startSearch(ll);
      await nextCheck(search);
      await nextCheck(search);

      await expect(search.result).resolves.toBe(booking);
      expect(search.attempts).toEqual([
        {
          kind: 'interrupted',
          error: tokenFailure,
          retryInMs: expect.any(Number),
        },
      ]);
    });

    it.each([
      STATUS_SERVICE_UNAVAILABLE,
      STATUS_FORBIDDEN,
      STATUS_TOO_MANY_REQUESTS,
      STATUS_NETWORK_FAILURE,
    ])('tries again after a request fails with status %d', async status => {
      const ll = fakeLL();
      const failure = requestError(status);
      ll.offer
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(offerAt('11:30'));

      const search = startSearch(ll);
      await nextCheck(search);
      await nextCheck(search);

      await expect(search.result).resolves.toBe(booking);
      expect(search.attempts).toEqual([
        {
          kind: 'interrupted',
          error: failure,
          retryInMs: expect.any(Number),
        },
      ]);
    });

    it.each<FinalError>([
      {
        cause: 'Disney answers 401',
        error: requestError(STATUS_UNAUTHORIZED),
      },
      {
        cause: 'the login has to be renewed',
        error: new ReauthNeeded(),
      },
      {
        cause: 'the booking can no longer be modified',
        error: new ModifyNotAllowed(),
      },
      {
        cause: 'the client refuses to send more requests',
        error: new RateLimitExceeded(),
      },
    ])('ends when $cause', async ({ error }) => {
      const ll = fakeLL();
      ll.offer.mockRejectedValue(error);

      const search = startSearch(ll);

      await expect(search.result).rejects.toBe(error);
      expect(ll.offer).toHaveBeenCalledTimes(1);
      expect(search.attempts).toEqual([]);
    });

    it('survives twenty interruptions in a row without ever waiting longer than 30 seconds', async () => {
      const interruptionCount = 20;
      const ll = fakeLL();
      ll.offer.mockRejectedValue(requestError(STATUS_SERVICE_UNAVAILABLE));

      const search = startSearch(ll);

      for (let check = 0; check < interruptionCount; check += 1) {
        await nextCheck(search);
      }

      const waits = search.attempts.map(attempt => attempt.retryInMs);

      expect(search.attempts).toHaveLength(interruptionCount);
      expect(Math.max(...waits)).toBe(LONGEST_WAIT_MS);

      ll.offer.mockResolvedValue(offerAt('11:30'));
      await nextCheck(search);

      await expect(search.result).resolves.toBe(booking);
    });
  });

  describe('stopping', () => {
    it('rejects with the reason it was stopped for when aborted during the wait', async () => {
      const ll = fakeLL();
      ll.offer.mockResolvedValue(offerAt('10:00'));

      const search = startSearch(ll);
      await nextCheck(search);
      await stopSearch(search);
      await jest.advanceTimersByTimeAsync(LONGEST_WAIT_MS);

      expect(ll.offer).toHaveBeenCalledTimes(1);
      expect(ll.book).not.toHaveBeenCalled();
    });
  });

  describe('where guests can choose their return time', () => {
    it('moves an out-of-range offer to the earliest time in range and books it', async () => {
      const ll = fakeLL(TIME_SELECTION);
      const firstOffer = offerAt('10:00');
      const movedOffer = offerAt('11:20');
      ll.offer.mockResolvedValue(firstOffer);
      ll.times.mockResolvedValue([
        [ParkTime.from('10:20'), ParkTime.from('10:40')],
        [ParkTime.from('11:40'), ParkTime.from('11:20')],
        [ParkTime.from('12:05')],
      ]);
      ll.changeOfferTime.mockResolvedValue(movedOffer);

      const search = startSearch(ll);
      await nextCheck(search);

      await expect(search.result).resolves.toBe(booking);
      expect(ll.times).toHaveBeenCalledWith(firstOffer);
      expect(ll.changeOfferTime).toHaveBeenCalledWith(
        firstOffer,
        ParkTime.from('11:20')
      );
      expect(ll.book).toHaveBeenCalledWith(movedOffer, party);
    });

    it('changes nothing when no time in range is available', async () => {
      const ll = fakeLL(TIME_SELECTION);
      ll.offer.mockResolvedValue(offerAt('10:00'));
      ll.times.mockResolvedValue([
        [ParkTime.from('10:20'), ParkTime.from('10:40')],
        [ParkTime.from('12:05')],
      ]);

      const search = startSearch(ll);
      await nextCheck(search);

      expect(search.attempts).toEqual([
        {
          kind: 'outside-range',
          offeredTime: ParkTime.from('10:00'),
          retryInMs: POLL_INTERVAL_MS,
        },
      ]);
      expect(ll.changeOfferTime).not.toHaveBeenCalled();
      expect(ll.book).not.toHaveBeenCalled();

      await stopSearch(search);
    });

    it('does not book a moved offer that comes back outside the range', async () => {
      const ll = fakeLL(TIME_SELECTION);
      ll.offer.mockResolvedValue(offerAt('10:00'));
      ll.times.mockResolvedValue([[ParkTime.from('11:20')]]);
      ll.changeOfferTime.mockResolvedValue(offerAt('12:30'));

      const search = startSearch(ll);
      await nextCheck(search);

      expect(search.attempts).toEqual([
        {
          kind: 'outside-range',
          offeredTime: ParkTime.from('12:30'),
          retryInMs: POLL_INTERVAL_MS,
        },
      ]);
      expect(ll.book).not.toHaveBeenCalled();

      await stopSearch(search);
    });

    it('books an offer that is already in range without moving it', async () => {
      const ll = fakeLL(TIME_SELECTION);
      const offered = offerAt('11:30');
      ll.offer.mockResolvedValue(offered);

      const search = startSearch(ll);
      await nextCheck(search);

      await expect(search.result).resolves.toBe(booking);
      expect(ll.times).not.toHaveBeenCalled();
      expect(ll.changeOfferTime).not.toHaveBeenCalled();
      expect(ll.book).toHaveBeenCalledWith(offered, party);
    });
  });

  describe('where guests cannot choose their return time', () => {
    it('never asks for the times an out-of-range offer could move to', async () => {
      const ll = fakeLL(NO_TIME_SELECTION);
      ll.offer.mockResolvedValue(offerAt('10:00'));

      const search = startSearch(ll);
      await nextCheck(search);

      expect(search.attempts).toHaveLength(1);
      expect(ll.times).not.toHaveBeenCalled();
      expect(ll.changeOfferTime).not.toHaveBeenCalled();

      await stopSearch(search);
    });
  });
});
