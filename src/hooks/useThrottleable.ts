import { useCallback, useLayoutEffect, useState } from 'react';

export default function useThrottleable(callback: () => void) {
  const [lastCalled, setLastCalled] = useState(0);

  useLayoutEffect(() => {
    if (lastCalled > 0) callback();
  }, [lastCalled, callback]);

  return useCallback((timeSinceLastCallMS = 0) => {
    setLastCalled(lastCall =>
      Date.now() - lastCall < timeSinceLastCallMS ? lastCall : Date.now()
    );
  }, []);
}
