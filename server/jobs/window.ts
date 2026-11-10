import { RESORT_TIME_ZONES, type ResortId } from '@/api/resort';
import { DateTime, ParkTime, dateTimeInZone, parkDate } from '@/datetime';

import type { Job } from './job';

// When a job may book: the park date and the return times the guest accepts.
export type BookingWindow = Pick<Job, 'bookingDate' | 'earliest' | 'latest'>;

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

// Whether no return time in the window can be booked anymore: its date has
// passed, or it is that date and the latest return time has passed.
export function isWindowOver(window: BookingWindow, now: DateTime): boolean {
  const today = parkDate(now);

  if (window.bookingDate !== today) {
    return window.bookingDate < today;
  }

  return now.time > ParkTime.from(window.latest);
}
