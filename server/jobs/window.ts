import type { ReturnTimeRange } from '@/api/ll/auto-book';
import { RESORT_TIME_ZONES, type ResortId } from '@/api/resort';
import { DateTime, ParkTime, dateTimeInZone, parkDate } from '@/datetime';

import type { Job } from './job';

// When a job may book: the park date and the return times the guest accepts.
// A window that moves with the clock also accepts any return time up to
// `rollingWaitMinutes` from now.
export type BookingWindow = Pick<
  Job,
  'bookingDate' | 'earliest' | 'latest' | 'rollingWaitMinutes'
>;

// The date and time at a resort right now. Jobs for both resorts run side by
// side, so this never relies on the single time zone DateTime is set to.
export function resortNow(resortId: ResortId): DateTime {
  return dateTimeInZone(RESORT_TIME_ZONES[resortId]);
}

// Whether the latest return time comes before the earliest. Times compare
// within a park day, which runs past midnight, so 1 AM is later than 11 PM.
export function isRangeBackward(window: BookingWindow): boolean {
  return ParkTime.from(window.latest) < ParkTime.from(window.earliest);
}

// The return times accepted at the moment `now`. A fixed window always
// accepts the same ones; a moving one reaches `rollingWaitMinutes` past now
// once that is later than its latest time.
export function currentRange(
  window: BookingWindow,
  now: ParkTime
): ReturnTimeRange {
  const earliest = ParkTime.from(window.earliest);
  const latest = ParkTime.from(window.latest);

  if (window.rollingWaitMinutes === null) {
    return {
      earliest,
      latest,
    };
  }

  const rollingLatest = now.add({
    minutes: window.rollingWaitMinutes,
  });

  return {
    earliest,
    latest: rollingLatest > latest ? rollingLatest : latest,
  };
}

// Whether no return time in the window can be booked anymore: its date has
// passed, or it is that date and the latest return time has passed. A window
// that moves with the clock lasts until its park day is over.
export function isWindowOver(window: BookingWindow, now: DateTime): boolean {
  const today = parkDate(now);

  if (window.bookingDate !== today) {
    return window.bookingDate < today;
  }

  if (window.rollingWaitMinutes !== null) {
    return false;
  }

  return now.time > ParkTime.from(window.latest);
}
