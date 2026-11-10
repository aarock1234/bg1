/** @jest-environment node */
import { RequestError } from '@/api/client';

import { describeError } from './describe-error';

const STATUS_FORBIDDEN = 403;

const SQL = 'insert into "jobs" ("guests", "encrypted_login") values ($1, $2)';
const GUEST_NAME = 'Mickey Mouse';
const ENCRYPTED_LOGIN = 'ENCRYPTED_LOGIN';
const UNIQUE_VIOLATION = '23505';

// A refused query as the database library throws it: the message spells out
// the SQL and its parameters, and the cause carries the database's own code.
function failedQuery(cause: unknown): Error {
  const params = [GUEST_NAME, ENCRYPTED_LOGIN];
  const error = new Error(`Failed query: ${SQL}\nparams: ${params.join(',')}`, {
    cause,
  });

  return Object.assign(error, {
    query: SQL,
    params,
  });
}

function databaseError(code: string): Error {
  return Object.assign(new Error('duplicate key value'), {
    code,
  });
}

describe('describeError()', () => {
  describe('a query the database refused', () => {
    it('gives the name of the error and the code of the database', () => {
      const error = failedQuery(databaseError(UNIQUE_VIOLATION));

      expect(describeError(error)).toEqual({
        errorName: 'Error',
        databaseCode: UNIQUE_VIOLATION,
      });
    });

    it('never yields the SQL or its parameters', () => {
      const error = failedQuery(databaseError(UNIQUE_VIOLATION));

      const logged = JSON.stringify(describeError(error));

      expect(logged).not.toContain(SQL);
      expect(logged).not.toContain(GUEST_NAME);
      expect(logged).not.toContain(ENCRYPTED_LOGIN);
    });

    it('leaves the code out when the database gave none', () => {
      const error = failedQuery(undefined);

      expect(describeError(error)).toEqual({
        errorName: 'Error',
        databaseCode: undefined,
      });
    });
  });

  describe('a request Disney refused', () => {
    it('gives the status without what Disney answered', () => {
      const error = new RequestError({
        ok: false,
        status: STATUS_FORBIDDEN,
        data: {
          guestName: GUEST_NAME,
        },
      });

      expect(describeError(error)).toEqual({
        errorName: 'RequestError',
        status: STATUS_FORBIDDEN,
      });
    });
  });

  describe('any other error', () => {
    it('gives its name and where it was thrown', () => {
      const error = new TypeError('something broke');

      expect(describeError(error)).toEqual({
        errorName: 'TypeError',
        stack: error.stack,
      });
    });

    it.each([undefined, null, 'a thrown string', 42])(
      'calls the thrown value %p unknown',
      thrown => {
        expect(describeError(thrown)).toEqual({
          errorName: 'unknown',
        });
      }
    );
  });
});
