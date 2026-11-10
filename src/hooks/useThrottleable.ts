import { useCallback, useLayoutEffect, useState } from 'react';

// Requests a call of the wrapped callback. The request is ignored when the
// previous call happened less than `minIntervalMs` ago.
export type Throttleable = (minIntervalMs?: number) => void;

export default function useThrottleable(callback: () => void): Throttleable {
  const [lastCalled, setLastCalled] = useState(0);

  useLayoutEffect(() => {
    if (lastCalled > 0) {
      callback();
    }
  }, [lastCalled, callback]);

  return useCallback((minIntervalMs = 0) => {
    setLastCalled(previousCall => {
      const now = Date.now();
      const isTooSoon = now - previousCall < minIntervalMs;

      return isTooSoon ? previousCall : now;
    });
  }, []);
}
