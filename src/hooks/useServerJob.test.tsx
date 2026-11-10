import {
  type JobView,
  ServerRequestFailed,
  cancelJob,
  createJob,
  getJob,
} from '@/api/bg1-server';
import kvdb from '@/kvdb';
import { act, renderHook } from '@/testing';

import useServerJob, { type JobSearch } from './useServerJob';

jest.mock('@/api/bg1-server', () => {
  return {
    ...jest.requireActual<typeof import('@/api/bg1-server')>(
      '@/api/bg1-server'
    ),
    createJob: jest.fn(),
    getJob: jest.fn(),
    cancelJob: jest.fn(),
  };
});
jest.mock('@/push');

// Where the hook keeps the jobs it follows, and how often it checks on one.
const JOBS_KEY = 'bg1.server.jobs';
const POLL_INTERVAL_MS = 3000;

const STATUS_UNREACHABLE = 0;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const STATUS_UNPROCESSABLE = 422;

const EXPERIENCE_ID = '80010190';
const JOB_ID = '5f0c1d6e-8a53-4c7b-9a51-0d2f3b6c7e81';
const JOB_TOKEN = 'job-token';

// What the hook stores while it follows the job.
const STORED_JOB = {
  [EXPERIENCE_ID]: {
    id: JOB_ID,
    token: JOB_TOKEN,
  },
};

const search: JobSearch = {
  resortId: 'WDW',
  login: {
    swid: 'SWID',
    accessToken: 'ACCESS_TOKEN',
    expires: Date.UTC(2021, 9, 2),
  },
  experienceId: EXPERIENCE_ID,
  guests: [
    {
      id: 'mickey',
      name: 'Mickey Mouse',
    },
  ],
  date: '2021-10-01',
  earliest: '11:00:00',
  latest: '12:00:00',
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function jobView(overrides: Partial<JobView> = {}): JobView {
  return {
    id: JOB_ID,
    status: 'searching',
    resortId: 'WDW',
    experienceId: EXPERIENCE_ID,
    experienceName: 'Space Mountain',
    guestNames: ['Mickey Mouse'],
    date: '2021-10-01',
    earliest: '11:00:00',
    latest: '12:00:00',
    attempts: 0,
    lastAttempt: null,
    result: null,
    failure: null,
    createdAt: '2021-10-01T14:00:00.000Z',
    updatedAt: '2021-10-01T14:00:00.000Z',
    finishedAt: null,
    ...overrides,
  };
}

function bookedJob(): JobView {
  return jobView({
    status: 'booked',
    result: {
      experienceName: 'Space Mountain',
      start: '2021-10-01T11:15:00',
      end: '2021-10-01T12:15:00',
      guestNames: ['Mickey Mouse'],
    },
  });
}

// A request whose answer arrives when the test says so.
function deferred<T>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'] = () => undefined;

  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });

  return {
    promise,
    resolve,
  };
}

// Leaves a job behind as an earlier visit to the screen would have.
function storeJob(): void {
  kvdb.set(JOBS_KEY, STORED_JOB);
}

function storedJobs(): unknown {
  return kvdb.get(JOBS_KEY);
}

function renderServerJob(onBooked: (job: JobView) => void = jest.fn()) {
  return renderHook(() => {
    return useServerJob(EXPERIENCE_ID, {
      onBooked,
    });
  });
}

// Lets the server's pending answers arrive and the hook take them in.
async function answersArrive(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

// Lets enough time pass for the hook to check on the job once more.
async function nextCheck(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers({
    advanceTimers: false,
  });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  kvdb.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useServerJob()', () => {
  describe('picking up a search handed over earlier', () => {
    it('keeps following a stored job whose first check fails, and finds it on a later check', async () => {
      const job = jobView();
      storeJob();
      jest
        .mocked(getJob)
        .mockRejectedValueOnce(new ServerRequestFailed(STATUS_UNREACHABLE))
        .mockResolvedValueOnce(job);

      const { result } = renderServerJob();
      await answersArrive();

      expect(result.current.state).toEqual({
        kind: 'resuming',
      });
      expect(storedJobs()).toEqual(STORED_JOB);

      await nextCheck();

      expect(result.current.state).toEqual({
        kind: 'tracking',
        job,
      });
      expect(getJob).toHaveBeenCalledTimes(2);
      expect(getJob).toHaveBeenLastCalledWith(JOB_ID, JOB_TOKEN);
    });

    it.each([STATUS_NOT_FOUND, STATUS_UNAUTHORIZED])(
      'forgets a job the server answers %d for',
      async status => {
        storeJob();
        jest.mocked(getJob).mockRejectedValue(new ServerRequestFailed(status));

        const { result } = renderServerJob();
        await answersArrive();

        expect(result.current.state).toEqual({
          kind: 'idle',
        });
        expect(storedJobs()).toEqual({});

        await nextCheck();

        expect(getJob).toHaveBeenCalledTimes(1);
      }
    );
  });

  describe('a search that ended', () => {
    it('calls onBooked once for a job found booked, including across a remount', async () => {
      const job = bookedJob();
      const onBooked = jest.fn();
      storeJob();
      jest.mocked(getJob).mockResolvedValue(job);

      const { result: firstVisit, unmount } = renderServerJob(onBooked);
      await answersArrive();

      expect(firstVisit.current.state).toEqual({
        kind: 'tracking',
        job,
      });
      expect(onBooked).toHaveBeenCalledTimes(1);
      expect(onBooked).toHaveBeenCalledWith(job);

      unmount();
      const { result: secondVisit } = renderServerJob(onBooked);
      await answersArrive();
      await nextCheck();

      expect(secondVisit.current.state).toEqual({
        kind: 'idle',
      });
      expect(onBooked).toHaveBeenCalledTimes(1);
      expect(getJob).toHaveBeenCalledTimes(1);
    });

    it('shows an ended job once and then forgets it', async () => {
      const job = jobView({
        status: 'expired',
        failure: {
          code: 'window_over',
          message: 'No Lightning Lane came up within your return times.',
        },
      });
      const onBooked = jest.fn();
      storeJob();
      jest.mocked(getJob).mockResolvedValue(job);

      const { result: firstVisit, unmount } = renderServerJob(onBooked);
      await answersArrive();

      expect(firstVisit.current.state).toEqual({
        kind: 'tracking',
        job,
      });
      expect(storedJobs()).toEqual({});

      unmount();
      const { result: secondVisit } = renderServerJob(onBooked);
      await answersArrive();
      await nextCheck();

      expect(secondVisit.current.state).toEqual({
        kind: 'idle',
      });
      expect(getJob).toHaveBeenCalledTimes(1);
      expect(onBooked).not.toHaveBeenCalled();
    });
  });

  describe('starting', () => {
    it('hands the search to the server and keeps the token that can stop it', async () => {
      const job = jobView();
      jest.mocked(createJob).mockResolvedValue({
        job,
        token: JOB_TOKEN,
      });
      jest.mocked(getJob).mockResolvedValue(job);

      const { result } = renderServerJob();
      await act(() => result.current.start(search));

      expect(createJob).toHaveBeenCalledWith({
        ...search,
        pushSubscription: undefined,
      });
      expect(result.current.state).toEqual({
        kind: 'tracking',
        job,
      });
      expect(storedJobs()).toEqual(STORED_JOB);
    });

    it('does not create a second job or forget the first while a job is followed', async () => {
      const job = jobView();
      storeJob();
      jest.mocked(getJob).mockResolvedValue(job);

      const { result } = renderServerJob();
      await answersArrive();
      await act(() => result.current.start(search));

      expect(createJob).not.toHaveBeenCalled();
      expect(storedJobs()).toEqual(STORED_JOB);
      expect(result.current.state).toEqual({
        kind: 'tracking',
        job,
      });
    });

    it('reports a search the server turns down and stores nothing', async () => {
      const refusal = new ServerRequestFailed(
        STATUS_UNPROCESSABLE,
        'window_over'
      );
      jest.mocked(createJob).mockRejectedValue(refusal);

      const { result } = renderServerJob();
      await act(() => result.current.start(search));

      expect(result.current.state).toEqual({
        kind: 'rejected',
        error: refusal,
      });
      expect(storedJobs()).toBeUndefined();
    });
  });

  describe('stopping', () => {
    it('keeps the job and reports the failure when the stop fails', async () => {
      const job = jobView();
      const failure = new ServerRequestFailed(STATUS_UNREACHABLE);
      storeJob();
      jest.mocked(getJob).mockResolvedValue(job);
      jest.mocked(cancelJob).mockRejectedValue(failure);

      const { result } = renderServerJob();
      await answersArrive();
      await act(() => result.current.stop());

      expect(cancelJob).toHaveBeenCalledWith(JOB_ID, JOB_TOKEN);
      expect(result.current.stopError).toBe(failure);
      expect(result.current.state).toEqual({
        kind: 'tracking',
        job,
      });
      expect(storedJobs()).toEqual(STORED_JOB);
    });

    it('forgets the job and the earlier failure when a second stop succeeds', async () => {
      storeJob();
      jest.mocked(getJob).mockResolvedValue(jobView());
      jest
        .mocked(cancelJob)
        .mockRejectedValueOnce(new ServerRequestFailed(STATUS_UNREACHABLE))
        .mockResolvedValueOnce(
          jobView({
            status: 'cancelled',
          })
        );

      const { result } = renderServerJob();
      await answersArrive();
      await act(() => result.current.stop());
      await act(() => result.current.stop());

      expect(result.current.stopError).toBeUndefined();
      expect(result.current.state).toEqual({
        kind: 'idle',
      });
      expect(storedJobs()).toEqual({});
    });

    it('does not bring a stopped job back when a late answer about it arrives', async () => {
      const lateAnswer = deferred<JobView>();
      storeJob();
      jest.mocked(getJob).mockReturnValue(lateAnswer.promise);
      jest.mocked(cancelJob).mockResolvedValue(
        jobView({
          status: 'cancelled',
        })
      );

      const { result } = renderServerJob();
      await act(() => result.current.stop());

      lateAnswer.resolve(jobView());
      await answersArrive();

      expect(result.current.state).toEqual({
        kind: 'idle',
      });
      expect(storedJobs()).toEqual({});
    });

    it('still reports a job that booked just before it was stopped', async () => {
      const job = bookedJob();
      const onBooked = jest.fn();
      storeJob();
      jest.mocked(getJob).mockResolvedValue(jobView());
      jest.mocked(cancelJob).mockResolvedValue(job);

      const { result } = renderServerJob(onBooked);
      await answersArrive();
      await act(() => result.current.stop());

      expect(result.current.state).toEqual({
        kind: 'tracking',
        job,
      });
      expect(onBooked).toHaveBeenCalledTimes(1);
      expect(onBooked).toHaveBeenCalledWith(job);
      expect(storedJobs()).toEqual({});
    });
  });
});
