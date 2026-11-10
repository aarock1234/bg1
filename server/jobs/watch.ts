import type { LLClient } from '@/api/ll';
import {
  type AutoBookAttempt,
  type ReturnTimeRange,
  isFinal,
  isWithinRange,
  retryDelayMs,
  wait,
} from '@/api/ll/auto-book';
import type { Park } from '@/api/resort';
import type { ParkTime } from '@/datetime';

export type WatchRequest = {
  ll: Pick<LLClient, 'experiences'>;
  experienceId: string;
  park: Park;

  // The park date to watch, as YYYY-MM-DD.
  date: string;
  range: ReturnTimeRange;
  signal: AbortSignal;
  pollIntervalMs: number;
  onAttempt?: (attempt: AutoBookAttempt) => void;
};

type Found = {
  kind: 'found';
  time: ParkTime;
};

// A look at the tip board that didn't find a time in range.
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
      error: unknown;
    };

// One look at the park's tip board. Disney answers it without the
// bot-protection token that offers and bookings need.
async function checkReturnTime(request: WatchRequest): Promise<Found | Miss> {
  const { ll, park, date, experienceId, range } = request;
  const experiences = await ll.experiences(park, date);
  const experience = experiences.find(candidate => {
    return candidate.id === experienceId;
  });
  const time = experience?.flex?.nextAvailableTime;

  if (!experience?.flex?.available || !time) {
    return {
      kind: 'unavailable',
    };
  }

  if (!isWithinRange(time, range)) {
    return {
      kind: 'outside-range',
      offeredTime: time,
    };
  }

  return {
    kind: 'found',
    time,
  };
}

async function attemptCheck(request: WatchRequest): Promise<Found | Miss> {
  try {
    return await checkReturnTime(request);
  } catch (error) {
    if (request.signal.aborted || isFinal(error)) {
      throw error;
    }

    return {
      kind: 'interrupted',
      error,
    };
  }
}

// Watches an experience's next Lightning Lane return time until it falls
// within the range, and returns it. Disney refuses BG1's offers and bookings,
// so the guest books the time themselves once told about it. A check that
// goes wrong is tried again, as auto booking does, unless retrying can't
// help.
export async function watchForReturnTime(
  request: WatchRequest
): Promise<ParkTime> {
  const { signal, onAttempt, pollIntervalMs } = request;
  let consecutiveFailures = 0;

  while (true) {
    signal.throwIfAborted();

    const check = await attemptCheck(request);

    if (check.kind === 'found') {
      return check.time;
    }

    consecutiveFailures =
      check.kind === 'interrupted' ? consecutiveFailures + 1 : 0;

    const retryInMs = retryDelayMs(consecutiveFailures, pollIntervalMs);

    onAttempt?.({
      ...check,
      retryInMs,
    });

    await wait(retryInMs, signal);
  }
}
