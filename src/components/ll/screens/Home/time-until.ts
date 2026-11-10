import type { ParkTime } from '@/datetime';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

// Return times this close count as soon, and those up to the second limit as
// a while away. Anything later is just a time.
const SOON_MINUTES = 30;
const A_WHILE_MINUTES = 90;

// Standby waits up to the first limit are short, up to the second middling,
// and longer ones long.
const SHORT_WAIT_MINUTES = 20;
const MIDDLING_WAIT_MINUTES = 45;

export function minutesUntil(time: ParkTime, now: ParkTime): number {
  return Math.max(0, Math.round((+time - +now) / SECONDS_PER_MINUTE));
}

// How long until a time, such as "now", "in 25 min" or "in 1 h 10 min".
export function timeUntil(time: ParkTime, now: ParkTime): string {
  const minutes = minutesUntil(time, now);

  if (minutes === 0) {
    return 'now';
  }

  if (minutes < MINUTES_PER_HOUR) {
    return `in ${minutes} min`;
  }

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainder = minutes % MINUTES_PER_HOUR;

  return remainder === 0 ? `in ${hours} h` : `in ${hours} h ${remainder} min`;
}

// The color of a return time by how soon it is.
export function returnTimeTone(time: ParkTime, now: ParkTime): string {
  const minutes = minutesUntil(time, now);

  if (minutes <= SOON_MINUTES) {
    return 'text-good';
  }

  if (minutes <= A_WHILE_MINUTES) {
    return 'text-warn';
  }

  return 'text-muted';
}

// The color of a standby wait by its length.
export function waitTone(minutes: number): string {
  if (minutes <= SHORT_WAIT_MINUTES) {
    return 'text-good';
  }

  if (minutes <= MIDDLING_WAIT_MINUTES) {
    return 'text-warn';
  }

  return 'text-danger';
}
