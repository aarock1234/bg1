/** @jest-environment node */
import { matchesTokenHash, newJobToken } from './token';

describe('newJobToken()', () => {
  it('makes a different token every time', () => {
    const first = newJobToken();
    const second = newJobToken();

    expect(first.token).not.toBe(second.token);
    expect(first.hash).not.toBe(second.hash);
  });

  it('never stores the token itself as its hash', () => {
    const { token, hash } = newJobToken();

    expect(hash).not.toContain(token);
  });
});

describe('matchesTokenHash()', () => {
  it('accepts a token for its own hash', () => {
    const { token, hash } = newJobToken();

    expect(matchesTokenHash(token, hash)).toBe(true);
  });

  it("refuses a token for another token's hash", () => {
    const mine = newJobToken();
    const theirs = newJobToken();

    expect(matchesTokenHash(mine.token, theirs.hash)).toBe(false);
  });

  it('refuses the hash offered in place of the token', () => {
    const { hash } = newJobToken();

    expect(matchesTokenHash(hash, hash)).toBe(false);
  });

  it.each(['', 'abc123', 'not a hash'])(
    'refuses every token for the malformed hash "%s"',
    malformedHash => {
      const { token } = newJobToken();

      expect(matchesTokenHash(token, malformedHash)).toBe(false);
    }
  );
});
