/** @jest-environment node */
import { ParkTime } from '@/datetime';

import { JobStatus } from './job';
import { outcomeNotification } from './notification';
import { available } from './outcome';

// The push library is an ES module jest can't load, and the environment it
// reads is only set on the server. Neither matters to the wording tested here.
jest.mock('web-push', () => {
  return {
    sendNotification: jest.fn(),
    WebPushError: class WebPushError extends Error {},
  };
});

jest.mock('../config/env', () => {
  return {
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
    },
    NodeEnv: {
      DEVELOPMENT: 'development',
      PRODUCTION: 'production',
      TEST: 'test',
    },
  };
});

const job = {
  resortId: 'DLR' as const,
  experienceName: 'Space Mountain',
  bookingDate: '2026-11-10',
  guests: [
    {
      id: '1',
      name: 'Mickey Mouse',
      orderDetails: undefined,
    },
    {
      id: '2',
      name: 'Minnie Mouse',
      orderDetails: undefined,
    },
  ],
};

describe('available()', () => {
  it('records the return time that came up, on the job’s park date', () => {
    expect(available(job, ParkTime.from('15:15'))).toEqual({
      status: JobStatus.AVAILABLE,
      result: {
        experienceName: 'Space Mountain',
        start: '2026-11-10T15:15:00',
        end: '2026-11-10T15:15:00',
        guestNames: ['Mickey Mouse', 'Minnie Mouse'],
      },
    });
  });
});

describe('outcomeNotification()', () => {
  it('tells the guest to book an available time in the Disney app', () => {
    const outcome = available(job, ParkTime.from('15:15'));

    expect(outcomeNotification(job, outcome)).toEqual({
      title: 'Lightning Lane available now',
      body: "Space Mountain at 3:15 PM. Book it in the Disney app before it's gone.",
      url: 'https://bg1.abdels.dev/dlr',
    });
  });

  it('opens the page of the resort the job is for', () => {
    const outcome = available(job, ParkTime.from('09:05'));
    const notification = outcomeNotification(
      {
        ...job,
        resortId: 'WDW',
      },
      outcome
    );

    expect(notification.url).toBe('https://bg1.abdels.dev/wdw');
    expect(notification.body).toContain('9:05 AM');
  });
});
