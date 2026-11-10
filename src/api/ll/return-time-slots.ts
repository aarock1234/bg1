import { ParkTime } from '@/datetime';

import type { ParkHours } from '../ll';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// The step between the times a guest can choose, which also rounds the first
// one up from now.
const DEFAULT_SLOT_MINUTES = 5;

// Hours to assume until an offer has reported the park's actual hours.
const TYPICAL_PARK_HOURS: ParkHours = {
  openTime: new ParkTime(7),
  closeTime: new ParkTime(23, 45),
};

export type ReturnTimeSlotOptions = {
  parkHours?: ParkHours;

  // Leaves out slots before this time, such as the current time when booking
  // for today.
  notBefore?: ParkTime;

  slotMinutes?: number;
};

function roundUpToSlot(time: ParkTime, slotMinutes: number): ParkTime {
  const startedMinutes = time.hour * MINUTES_PER_HOUR + time.minute;
  const minutes = time.second > 0 ? startedMinutes + 1 : startedMinutes;
  const roundedMinutes = Math.ceil(minutes / slotMinutes) * slotMinutes;

  return new ParkTime().add({
    minutes: roundedMinutes,
  });
}

// Returns the evenly spaced times of day a guest can choose between as the
// bounds of a return time range, from park open (or `notBefore`) to close.
export function returnTimeSlots(
  options: ReturnTimeSlotOptions = {}
): ParkTime[] {
  const { openTime, closeTime } = options.parkHours ?? TYPICAL_PARK_HOURS;
  const slotMinutes = options.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const { notBefore } = options;

  const startTime = notBefore && notBefore > openTime ? notBefore : openTime;
  const maxSlots = Math.ceil(MINUTES_PER_DAY / slotMinutes);
  const slots: ParkTime[] = [];
  let slot = roundUpToSlot(startTime, slotMinutes);

  // A slot that sorts before the start has wrapped around into the next park
  // day.
  while (slot >= startTime && slot <= closeTime && slots.length < maxSlots) {
    slots.push(slot);
    slot = slot.add({
      minutes: slotMinutes,
    });
  }

  return slots;
}
