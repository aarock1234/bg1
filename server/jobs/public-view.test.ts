/** @jest-environment node */
import type { Job } from './job';
import { toJobView } from './public-view';

const TOKEN_HASH = 'TOKEN_HASH';
const ENCRYPTED_LOGIN = 'ENCRYPTED_LOGIN';
const PUSH_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/PUSH_ENDPOINT';
const PUSH_KEY = 'PUSH_KEY';
const PUSH_AUTH = 'PUSH_AUTH';
const ORDER_ID = 'ORDER_ID';
const LEASE_OWNER = 'LEASE_OWNER';

const CREATED_AT = new Date('2021-10-01T14:00:00.000Z');
const UPDATED_AT = new Date('2021-10-01T14:05:00.000Z');
const FINISHED_AT = new Date('2021-10-01T14:10:00.000Z');

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: '5f0c1d6e-8a53-4c7b-9a51-0d2f3b6c7e81',
    tokenHash: TOKEN_HASH,
    status: 'searching',
    resortId: 'WDW',
    experienceId: '80010190',
    experienceName: 'Space Mountain',
    guests: [
      {
        id: 'mickey',
        name: 'Mickey Mouse',
        orderDetails: {
          externalIdentifier: {
            id: 'mickey-id',
            idType: 'titus-guest-item-externalId',
          },
          orderId: ORDER_ID,
          orderItemId: 'mickey-orderItemId',
        },
      },
      {
        id: 'minnie',
        name: 'Minnie Mouse',
        orderDetails: undefined,
      },
    ],
    bookingDate: '2021-10-01',
    earliest: '11:00:00',
    latest: '12:00:00',
    rollingWaitMinutes: null,
    encryptedLogin: ENCRYPTED_LOGIN,
    loginExpiresAt: new Date('2021-10-02T04:00:00.000Z'),
    attemptCount: 7,
    lastAttempt: {
      kind: 'unavailable',
      at: '2021-10-01T14:05:00.000Z',
    },
    result: null,
    failureCode: null,
    failureMessage: null,
    pushSubscription: {
      endpoint: PUSH_ENDPOINT,
      keys: {
        p256dh: PUSH_KEY,
        auth: PUSH_AUTH,
      },
    },
    leaseOwner: LEASE_OWNER,
    leaseExpiresAt: new Date('2021-10-01T14:06:00.000Z'),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    finishedAt: null,
    ...overrides,
  };
}

describe('toJobView()', () => {
  it('tells the owner how the search is going', () => {
    expect(toJobView(job())).toEqual({
      id: '5f0c1d6e-8a53-4c7b-9a51-0d2f3b6c7e81',
      status: 'searching',
      resortId: 'WDW',
      experienceId: '80010190',
      experienceName: 'Space Mountain',
      guestNames: ['Mickey Mouse', 'Minnie Mouse'],
      date: '2021-10-01',
      earliest: '11:00:00',
      latest: '12:00:00',
      attempts: 7,
      lastAttempt: {
        kind: 'unavailable',
        at: '2021-10-01T14:05:00.000Z',
      },
      result: null,
      failure: null,
      createdAt: '2021-10-01T14:00:00.000Z',
      updatedAt: '2021-10-01T14:05:00.000Z',
      finishedAt: null,
    });
  });

  it.each([
    {
      secret: 'the token hash',
      value: TOKEN_HASH,
    },
    {
      secret: 'the login',
      value: ENCRYPTED_LOGIN,
    },
    {
      secret: "the push subscription's address",
      value: PUSH_ENDPOINT,
    },
    {
      secret: "the push subscription's key",
      value: PUSH_KEY,
    },
    {
      secret: "the push subscription's auth secret",
      value: PUSH_AUTH,
    },
    {
      secret: "a guest's order",
      value: ORDER_ID,
    },
    {
      secret: 'the worker holding the job',
      value: LEASE_OWNER,
    },
  ])('never contains $secret', ({ value }) => {
    const sent = JSON.stringify(toJobView(job()));

    expect(sent).not.toContain(value);
  });

  it('has no field for the token hash, the login or the push subscription', () => {
    const view = toJobView(job());

    expect(view).not.toHaveProperty('tokenHash');
    expect(view).not.toHaveProperty('encryptedLogin');
    expect(view).not.toHaveProperty('loginExpiresAt');
    expect(view).not.toHaveProperty('pushSubscription');
  });

  it('says why and when a search ended without a booking', () => {
    const view = toJobView(
      job({
        status: 'expired',
        failureCode: 'window_over',
        failureMessage: 'No Lightning Lane came up within your return times.',
        finishedAt: FINISHED_AT,
      })
    );

    expect(view.failure).toEqual({
      code: 'window_over',
      message: 'No Lightning Lane came up within your return times.',
    });
    expect(view.finishedAt).toBe('2021-10-01T14:10:00.000Z');
  });
});
