import { useCallback, useEffect, useRef, useState } from 'react';

import { LLMP } from '@/api/ll';
import { AutoBookAttempt, AutoBookRequest, autoBook } from '@/api/ll/auto-book';

// What to search for; the hook supplies the cancellation and progress hooks.
export type AutoBookSearch = Omit<AutoBookRequest, 'signal' | 'onAttempt'>;

export type AutoBookStatus =
  | {
      kind: 'idle';
    }
  | {
      kind: 'searching';
      attempts: number;
      lastAttempt?: AutoBookAttempt;
    }
  | {
      kind: 'failed';
      error: unknown;
    };

type AutoBookOptions = {
  // Called with the new booking. This can still happen just after `stop` if
  // the booking request had already been sent.
  onBooked: (booking: LLMP) => void;
};

type AutoBook = {
  status: AutoBookStatus;
  start: (search: AutoBookSearch) => void;
  stop: () => void;
};

const IDLE: AutoBookStatus = {
  kind: 'idle',
};

// Runs an auto-book search for as long as the component stays mounted, and
// reports its progress as state.
export default function useAutoBook({ onBooked }: AutoBookOptions): AutoBook {
  const [status, setStatus] = useState(IDLE);
  const searchController = useRef<AbortController>(undefined);
  const latestOnBooked = useRef(onBooked);

  useEffect(() => {
    latestOnBooked.current = onBooked;
  }, [onBooked]);

  const stop = useCallback(() => {
    searchController.current?.abort();
    searchController.current = undefined;
    setStatus(IDLE);
  }, []);

  const start = useCallback((search: AutoBookSearch) => {
    searchController.current?.abort();

    const controller = new AbortController();
    const { signal } = controller;
    searchController.current = controller;

    function recordAttempt(attempt: AutoBookAttempt): void {
      if (signal.aborted) {
        return;
      }

      setStatus(current => {
        const attempts = current.kind === 'searching' ? current.attempts : 0;

        return {
          kind: 'searching',
          attempts: attempts + 1,
          lastAttempt: attempt,
        };
      });
    }

    async function run(): Promise<void> {
      try {
        const booking = await autoBook({
          ...search,
          signal,
          onAttempt: recordAttempt,
        });

        if (searchController.current === controller) {
          searchController.current = undefined;
          setStatus(IDLE);
        }

        latestOnBooked.current(booking);
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        console.error('auto-book stopped', error);
        searchController.current = undefined;
        setStatus({
          kind: 'failed',
          error,
        });
      }
    }

    setStatus({
      kind: 'searching',
      attempts: 0,
    });
    void run();
  }, []);

  // A booking that arrives after the screen is gone has nowhere to be shown;
  // it appears in the guest's plans the next time they load.
  useEffect(() => {
    return () => {
      searchController.current?.abort();
      latestOnBooked.current = () => undefined;
    };
  }, []);

  return {
    status,
    start,
    stop,
  };
}
