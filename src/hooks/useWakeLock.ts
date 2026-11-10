import { useEffect } from 'react';

// Keeps the screen from turning off while `isActive` is true, on browsers
// that support it.
export default function useWakeLock(isActive: boolean): void {
  useEffect(() => {
    if (!isActive || !('wakeLock' in navigator)) {
      return;
    }

    let lock: WakeLockSentinel | undefined;
    let isReleased = false;

    async function acquire(): Promise<void> {
      try {
        const acquiredLock = await navigator.wakeLock.request('screen');

        if (isReleased) {
          await acquiredLock.release();
          return;
        }

        lock = acquiredLock;
      } catch (error) {
        // The browser can refuse, such as in battery saver mode. The page
        // keeps working; the screen is just free to sleep.
        console.warn('screen wake lock unavailable', error);
      }
    }

    // The browser drops the lock whenever the page is hidden.
    function reacquireWhenVisible(): void {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener('visibilitychange', reacquireWhenVisible);

    return () => {
      isReleased = true;
      document.removeEventListener('visibilitychange', reacquireWhenVisible);
      lock?.release().catch((error: unknown) => {
        console.warn('screen wake lock release failed', error);
      });
    };
  }, [isActive]);
}
