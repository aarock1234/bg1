import { serviceUrl } from '@/config';

// Maximum round-trip delay for an offset check to count.
const MAX_DELAY_MS = 500;

// Maximum difference between two offsets for them to agree.
const MAX_OFFSET_DIFF_MS = 100;

// Maximum offset checks per sync attempt.
const MAX_OFFSET_CHECKS = 5;

// Minimum interval before resyncing with the server.
export const MIN_RESYNC_MS = 5 * 60_000;

// The response header that carries the server's time in seconds.
const SERVER_TIME_HEADER = 'T';

let clockOffset = 0;
let lastSynced = 0;

export class SyncFailed extends Error {
  readonly name = 'SyncFailed';
}

// Returns the current time according to the server's clock.
export function now(): number {
  return Date.now() + clockOffset;
}

// Measures how far the device's clock is from the server's, so that `now` can
// correct for it. Throws SyncFailed when no two measurements agree.
export async function syncTime(): Promise<void> {
  const isRecentlySynced = Date.now() - lastSynced < MIN_RESYNC_MS;

  if (isRecentlySynced) {
    return;
  }

  const previouslySynced = lastSynced;
  lastSynced = Date.now();

  try {
    clockOffset = await measureClockOffset();
  } catch (error) {
    lastSynced = previouslySynced;
    throw error;
  }
}

// Checks the offset repeatedly until two of the checks agree, and returns the
// midpoint of those two.
async function measureClockOffset(): Promise<number> {
  const offsets: number[] = [];

  for (let check = 0; check < MAX_OFFSET_CHECKS; ++check) {
    const offset = await checkOffset();

    if (offset === undefined) {
      continue;
    }

    offsets.push(offset);

    const agreedOffset = findAgreedOffset(offsets);

    if (agreedOffset !== undefined) {
      return agreedOffset;
    }
  }

  throw new SyncFailed();
}

// Returns the midpoint of the two closest offsets, or undefined when even
// those are too far apart.
function findAgreedOffset(offsets: number[]): number | undefined {
  const sortedOffsets = [...offsets].sort((a, b) => a - b);

  let smallestDiff = Infinity;
  let midpoint: number | undefined;
  let lowerOffset: number | undefined;

  for (const offset of sortedOffsets) {
    if (lowerOffset !== undefined && offset - lowerOffset < smallestDiff) {
      smallestDiff = offset - lowerOffset;
      midpoint = Math.round((lowerOffset + offset) / 2);
    }

    lowerOffset = offset;
  }

  return smallestDiff <= MAX_OFFSET_DIFF_MS ? midpoint : undefined;
}

// Returns the offset in milliseconds between the server's clock and the
// device's, or undefined when it couldn't be measured reliably.
async function checkOffset(): Promise<number | undefined> {
  try {
    const startTime = Date.now();
    const { headers } = await fetch(serviceUrl('t'));
    const endTime = Date.now();

    const delay = endTime - startTime;

    if (delay > MAX_DELAY_MS) {
      return undefined;
    }

    // A missing header becomes "null", which is not a number.
    const serverTime = Number(String(headers?.get(SERVER_TIME_HEADER))) * 1000;
    const offset = Math.round(serverTime - (startTime + endTime) / 2);

    return Number.isInteger(offset) ? offset : undefined;
  } catch (error) {
    console.error(error);

    return undefined;
  }
}
