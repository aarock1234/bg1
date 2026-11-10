/** @jest-environment node */
import { minimumRequestsPerSecond } from './pace';

describe('minimumRequestsPerSecond()', () => {
  it.each([
    {
      pollIntervalMs: 1000,
      requestsPerSecond: 10,
    },
    {
      pollIntervalMs: 500,
      requestsPerSecond: 15,
    },
    {
      pollIntervalMs: 250,
      requestsPerSecond: 25,
    },
  ])(
    'allows $requestsPerSecond requests a second when checking every $pollIntervalMs ms',
    ({ pollIntervalMs, requestsPerSecond }) => {
      expect(minimumRequestsPerSecond(pollIntervalMs)).toBe(requestsPerSecond);
    }
  );
});
