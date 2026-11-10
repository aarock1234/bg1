import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

// The secret that lets its holder read and cancel one job. Only its hash is
// stored, so a copy of the database can't be used to act on jobs.
export type JobToken = {
  token: string;
  hash: string;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newJobToken(): JobToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  return {
    token,
    hash: sha256(token),
  };
}

// Whether the token is the one whose hash is stored, compared in constant
// time.
export function matchesTokenHash(token: string, tokenHash: string): boolean {
  const actual = Buffer.from(sha256(token), 'hex');
  const expected = Buffer.from(tokenHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
