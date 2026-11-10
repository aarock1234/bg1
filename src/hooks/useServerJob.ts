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

// While a job is stored for the experience it is being followed, which is the
// `resuming` state or `tracking` a job that is still `searching`. Every other
// state means no search is running at the server for this device.
export type ServerJobState =
  | {
      kind: 'idle';
    }
  | {
      kind: 'starting';
    }
  | {
      // A search was handed over earlier and the server hasn't been reached
      // yet to ask how it is going.
      kind: 'resuming';
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

// What came of asking the server about a job.
type JobAnswer =
  | {
      kind: 'found';
      job: JobView;
    }
  | {
      // The server no longer knows the job, or no longer accepts its token.
      kind: 'gone';
    }
  | {
      // The request failed, which says nothing about the job itself.
      kind: 'unanswered';
      error: unknown;
    };

type ServerJobOptions = {
  // Called when a search is found to have booked a Lightning Lane, including
  // one that booked while the app was closed.
  onBooked: (job: JobView) => void;
};

type ServerJob = {
  state: ServerJobState;

  // Why the latest request to stop the search failed, or undefined when it
  // didn't. The search is still being followed, so stopping can be tried
  // again.
  stopError: unknown;

  // Does nothing while a search is being followed: that one has to end, or
  // be stopped, before another can take its place.
  start: (search: JobSearch) => Promise<void>;
  stop: () => Promise<void>;
};

const IDLE: ServerJobState = {
  kind: 'idle',
};

const RESUMING: ServerJobState = {
  kind: 'resuming',
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

async function answerTo(request: Promise<JobView>): Promise<JobAnswer> {
  try {
    return {
      kind: 'found',
      job: await request,
    };
  } catch (error) {
    if (isJobGone(error)) {
      return {
        kind: 'gone',
      };
    }

    return {
      kind: 'unanswered',
      error,
    };
  }
}

// An answer about a job only counts while that job is still the one stored.
// Anything else arrived after the search was stopped, ended or replaced.
function isStillStored(experienceId: string, job: StoredJob): boolean {
  return storedJobs()[experienceId]?.id === job.id;
}

function initialState(experienceId: string): ServerJobState {
  return storedJobs()[experienceId] ? RESUMING : IDLE;
}

// Whether a search handed to the server is still running there, as far as
// this device knows.
export function isFollowingJob(state: ServerJobState): boolean {
  if (state.kind === 'resuming') {
    return true;
  }

  return state.kind === 'tracking' && state.job.status === 'searching';
}

// Hands a search for one experience to the BG1 server and follows it. The
// search keeps running on the server when the app is closed, and is picked up
// again the next time this screen opens.
//
// A stored job is followed until the server reports that it ended, or that it
// is gone. Nothing else forgets a job: its token is the only way to stop a
// search that can still book.
export default function useServerJob(
  experienceId: string,
  { onBooked }: ServerJobOptions
): ServerJob {
  const [state, setState] = useState(() => initialState(experienceId));
  const [stopError, setStopError] = useState<unknown>();
  const latestOnBooked = useRef(onBooked);
  const isFollowing = isFollowingJob(state);

  useEffect(() => {
    latestOnBooked.current = onBooked;
  }, [onBooked]);

  // Asks the server how the stored job is going. A request that fails leaves
  // everything as it is, to be asked again at the next turn.
  const refresh = useCallback(async (): Promise<void> => {
    const stored = storedJobs()[experienceId];

    if (!stored) {
      // BG1 open in another tab saw the search end and forgot it.
      setState(current => (isFollowingJob(current) ? IDLE : current));
      return;
    }

    const answer = await answerTo(getJob(stored.id, stored.token));

    if (!isStillStored(experienceId, stored)) {
      return;
    }

    if (answer.kind === 'unanswered') {
      console.warn('server job check failed', answer.error);
      return;
    }

    if (answer.kind === 'gone') {
      storeJob(experienceId, undefined);
      setStopError(undefined);
      setState(IDLE);
      return;
    }

    const { job } = answer;

    setState({
      kind: 'tracking',
      job,
    });

    if (job.status === 'searching') {
      return;
    }

    // An ended search is shown once. Forgetting it here keeps yesterday's
    // outcome from greeting the guest every time the screen opens.
    storeJob(experienceId, undefined);
    setStopError(undefined);

    if (job.status === 'booked') {
      latestOnBooked.current(job);
    }
  }, [experienceId]);

  // Picks up a search handed over earlier.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isFollowing) {
      return;
    }

    const intervalId = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isFollowing, refresh]);

  const start = useCallback(
    async (search: JobSearch) => {
      // Starting over a search that is being followed would replace its
      // token, leaving it running with no way to stop it.
      if (storedJobs()[experienceId]) {
        return;
      }

      setStopError(undefined);
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

    const answer = await answerTo(cancelJob(stored.id, stored.token));

    if (!isStillStored(experienceId, stored)) {
      return;
    }

    // The search carries on at the server, so it is still followed and its
    // token kept for another try.
    if (answer.kind === 'unanswered') {
      console.error('server job could not be stopped', answer.error);
      setStopError(answer.error);
      return;
    }

    storeJob(experienceId, undefined);
    setStopError(undefined);

    // The search may have booked just before the request to stop it.
    if (answer.kind === 'found' && answer.job.status === 'booked') {
      setState({
        kind: 'tracking',
        job: answer.job,
      });
      latestOnBooked.current(answer.job);
      return;
    }

    setState(IDLE);
  }, [experienceId]);

  return {
    state,
    stopError,
    start,
    stop,
  };
}
