import { hm, mk } from '@/__fixtures__/ll';
import { RequestError } from '@/api/client';
import type { Experience } from '@/api/ll';
import type { AutoBookAttempt, ReturnTimeRange } from '@/api/ll/auto-book';
import { ParkTime } from '@/datetime';
import { TODAY } from '@/testing';

import { type WatchRequest, watchForReturnTime } from './watch';

const POLL_INTERVAL_MS = 15_000;

// What Math.random returns for the longest wait the jitter allows.
const LONGEST_JITTER = 1;

const STATUS_UNAUTHORIZED = 401;
const STATUS_SERVICE_UNAVAILABLE = 503;

const STOPPED = new Error('the test stopped the watch');

const range: ReturnTimeRange = {
  earliest: ParkTime.from('11:00'),
  latest: ParkTime.from('12:00'),
};

type FakeLL = jest.Mocked<WatchRequest['ll']>;

type Watch = {
  // Every miss the watch has reported, oldest first.
  attempts: AutoBookAttempt[];
  controller: AbortController;
  result: Promise<ParkTime>;
};

function fakeLL(): FakeLL {
  return {
    experiences: jest.fn(),
  };
}

// The tip board as Disney answers it, with the watched experience's next
// return time set to `time`, or with no return time at all.
function tipBoard(time: string | undefined): Experience[] {
  return [
    {
      ...hm,
      flex: {
        available: time !== undefined,
        nextAvailableTime: time === undefined ? undefined : ParkTime.from(time),
      },
    },
  ];
}

function requestError(status: number): RequestError {
  return new RequestError({
    ok: false,
    status,
    data: {},
  });
}

function startWatch(ll: FakeLL): Watch {
  const attempts: AutoBookAttempt[] = [];
  const controller = new AbortController();

  const result = watchForReturnTime({
    ll,
    experienceId: hm.id,
    park: mk,
    date: TODAY,
    range,
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
async function nextCheck(watch: Watch): Promise<void> {
  const waitMs = watch.attempts.at(-1)?.retryInMs ?? 0;

  await jest.advanceTimersByTimeAsync(waitMs);
}

// Ends a watch that would otherwise keep checking forever.
async function stopWatch(watch: Watch): Promise<void> {
  watch.controller.abort(STOPPED);

  await expect(watch.result).rejects.toBe(STOPPED);
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

describe('watchForReturnTime()', () => {
  it('returns the next return time once it falls within the range', async () => {
    const ll = fakeLL();
    ll.experiences.mockResolvedValue(tipBoard('11:30'));

    const watch = startWatch(ll);
    await nextCheck(watch);

    await expect(watch.result).resolves.toEqual(ParkTime.from('11:30'));
    expect(ll.experiences).toHaveBeenCalledWith(mk, TODAY);
    expect(watch.attempts).toEqual([]);
  });

  it('keeps watching while the next return time is outside the range', async () => {
    const ll = fakeLL();
    ll.experiences
      .mockResolvedValueOnce(tipBoard('12:30'))
      .mockResolvedValueOnce(tipBoard('12:00'));

    const watch = startWatch(ll);
    await nextCheck(watch);

    expect(watch.attempts).toEqual([
      {
        kind: 'outside-range',
        offeredTime: ParkTime.from('12:30'),
        retryInMs: POLL_INTERVAL_MS,
      },
    ]);

    await nextCheck(watch);

    await expect(watch.result).resolves.toEqual(ParkTime.from('12:00'));
  });

  it('reports no return time as unavailable and keeps watching', async () => {
    const ll = fakeLL();
    ll.experiences.mockResolvedValue(tipBoard(undefined));

    const watch = startWatch(ll);
    await nextCheck(watch);

    expect(watch.attempts).toEqual([
      {
        kind: 'unavailable',
        retryInMs: POLL_INTERVAL_MS,
      },
    ]);

    await stopWatch(watch);
  });

  it('reports an experience missing from the tip board as unavailable', async () => {
    const ll = fakeLL();
    ll.experiences.mockResolvedValue([]);

    const watch = startWatch(ll);
    await nextCheck(watch);

    expect(watch.attempts.map(attempt => attempt.kind)).toEqual([
      'unavailable',
    ]);

    await stopWatch(watch);
  });

  it('tries again after a failed check, waiting longer, then finds a time', async () => {
    const failure = requestError(STATUS_SERVICE_UNAVAILABLE);
    const ll = fakeLL();
    ll.experiences
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(tipBoard('11:15'));

    const watch = startWatch(ll);
    await nextCheck(watch);

    expect(watch.attempts).toEqual([
      {
        kind: 'interrupted',
        error: failure,
        retryInMs: POLL_INTERVAL_MS * 2,
      },
    ]);

    await nextCheck(watch);

    await expect(watch.result).resolves.toEqual(ParkTime.from('11:15'));
  });

  it('ends when Disney no longer accepts the login', async () => {
    const failure = requestError(STATUS_UNAUTHORIZED);
    const ll = fakeLL();
    ll.experiences.mockRejectedValue(failure);

    const watch = startWatch(ll);
    const outcome = watch.result.catch((error: unknown) => error);
    await nextCheck(watch);

    expect(await outcome).toBe(failure);
    expect(watch.attempts).toEqual([]);
  });
});
