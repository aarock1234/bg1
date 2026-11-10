const MS_PER_SECOND = 1000;

// The most requests one auto-book check can make: the offer, the times it
// could be moved to, the move, the booking, and the cancellation for guests
// who weren't chosen.
const MAX_REQUESTS_PER_CHECK = 5;

// Returns the lowest per-second request limit that auto booking at the given
// pace can never exceed. A client's rate limit refuses every later request
// once it is exceeded, so the limit has to cover the worst case: every check
// that can start within one second making all of its requests, on top of a
// check that started just before.
export function minimumRequestsPerSecond(pollIntervalMs: number): number {
  const checksStartedPerSecond = Math.ceil(MS_PER_SECOND / pollIntervalMs);

  return MAX_REQUESTS_PER_CHECK * (checksStartedPerSecond + 1);
}
