import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CreateJobRequest,
  JobView,
  ServerRequestFailed,
  cancelJob,
  createJob,
  getJob,
} from '@/api/bg1-server';
import kvdb from '@/kvdb';
import { requestPushSubscription } from '@/push';

// The searches this device has handed to the server, by experience ID, with
// the token that lets it check on and cancel each one.
const JOBS_KEY = 'bg1.server.jobs';

// How often to ask the server how a running search is going.
const POLL_INTERVAL_MS = 3000;

const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;

// What the guest wants found. The hook adds this device's notification
// details.
export type JobSearch = Omit<CreateJobRequest, 'pushSubscription'>;

export type ServerJobState =
  | {
      kind: 'idle';
    }
  | {
      kind: 'starting';
    }
  | {
      // The server has the search. `job.status` says how it is going or how
      // it ended.
      kind: 'tracking';
      job: JobView;
    }
  | {
      // The server didn't take the search, or couldn't be reached.
      kind: 'rejected';
      error: unknown;
    };

type StoredJob = {
  id: string;
  token: string;
};

type ServerJobOptions = {
  // Called when a search is found to have booked a Lightning Lane, including
  // one that booked while the app was closed.
  onBooked: (job: JobView) => void;
};

type ServerJob = {
  state: ServerJobState;
  start: (search: JobSearch) => Promise<void>;
  stop: () => Promise<void>;

  // Clears a search that has ended, making room for a new one.
  dismiss: () => void;
};

const IDLE: ServerJobState = {
  kind: 'idle',
};

function isStoredJob(value: unknown): value is StoredJob {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'token' in value &&
    typeof value.token === 'string'
  );
}

function storedJobs(): Record<string, StoredJob> {
  const stored = kvdb.get(JOBS_KEY);

  if (typeof stored !== 'object' || stored === null) {
    return {};
  }

  const jobs: Record<string, StoredJob> = {};

  for (const [experienceId, job] of Object.entries(stored)) {
    if (isStoredJob(job)) {
      jobs[experienceId] = job;
    }
  }

  return jobs;
}

function storeJob(experienceId: string, job: StoredJob | undefined): void {
  const jobs = storedJobs();

  if (job) {
    jobs[experienceId] = job;
  } else {
    delete jobs[experienceId];
  }

  kvdb.set(JOBS_KEY, jobs);
}

// The server no longer knows the job, or no longer accepts its token.
function isJobGone(error: unknown): boolean {
  if (!(error instanceof ServerRequestFailed)) {
    return false;
  }

  return (
    error.status === STATUS_NOT_FOUND || error.status === STATUS_UNAUTHORIZED
  );
}

// Hands a search for one experience to the BG1 server and follows it. The
// search keeps running on the server when the app is closed, and is picked up
// again the next time this screen opens.
export default function useServerJob(
  experienceId: string,
  { onBooked }: ServerJobOptions
): ServerJob {
  const [state, setState] = useState(IDLE);
  const latestOnBooked = useRef(onBooked);
  const trackedJob = state.kind === 'tracking' ? state.job : undefined;
  const isSearching = trackedJob?.status === 'searching';

  useEffect(() => {
    latestOnBooked.current = onBooked;
  }, [onBooked]);

  // Fetches the job's latest state. Returns false once there is nothing left
  // to follow.
  const refresh = useCallback(async (): Promise<boolean> => {
    const stored = storedJobs()[experienceId];

    if (!stored) {
      return false;
    }

    try {
      const job = await getJob(stored.id, stored.token);

      setState({
        kind: 'tracking',
        job,
      });

      if (job.status === 'searching') {
        return true;
      }

      // An ended search is shown once. Forgetting it here keeps yesterday's
      // outcome from greeting the guest every time the screen opens.
      storeJob(experienceId, undefined);

      if (job.status === 'booked') {
        latestOnBooked.current(job);
      }

      return false;
    } catch (error) {
      if (isJobGone(error)) {
        storeJob(experienceId, undefined);
        setState(IDLE);

        return false;
      }

      // A failed check says nothing about the search itself, which carries
      // on at the server. Try again at the next turn.
      console.warn('server job check failed', error);

      return true;
    }
  }, [experienceId]);

  // Picks up a search handed over earlier.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isSearching) {
      return;
    }

    const intervalId = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isSearching, refresh]);

  const start = useCallback(
    async (search: JobSearch) => {
      setState({
        kind: 'starting',
      });

      try {
        const pushSubscription = await requestPushSubscription();
        const { job, token } = await createJob({
          ...search,
          pushSubscription,
        });

        storeJob(experienceId, {
          id: job.id,
          token,
        });
        setState({
          kind: 'tracking',
          job,
        });
      } catch (error) {
        console.error('server job could not be started', error);
        setState({
          kind: 'rejected',
          error,
        });
      }
    },
    [experienceId]
  );

  const stop = useCallback(async () => {
    const stored = storedJobs()[experienceId];

    if (!stored) {
      setState(IDLE);
      return;
    }

    try {
      const job = await cancelJob(stored.id, stored.token);

      // The search may have booked just before the request to stop it.
      if (job.status === 'booked') {
        setState({
          kind: 'tracking',
          job,
        });
        latestOnBooked.current(job);
        return;
      }
    } catch (error) {
      if (!isJobGone(error)) {
        console.error('server job could not be stopped', error);
        setState({
          kind: 'rejected',
          error,
        });
        return;
      }
    }

    storeJob(experienceId, undefined);
    setState(IDLE);
  }, [experienceId]);

  const dismiss = useCallback(() => {
    storeJob(experienceId, undefined);
    setState(IDLE);
  }, [experienceId]);

  return {
    state,
    start,
    stop,
    dismiss,
  };
}
