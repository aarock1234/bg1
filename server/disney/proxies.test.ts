/** @jest-environment node */
import { parseProxies } from './proxies';

const MALFORMED_PROXY = 'proxy must be written as host:port:username:password';

describe('parseProxies()', () => {
  it('reads one proxy per line', () => {
    const list = 'one.example:8080:alice:secret\ntwo.example:9090:bob:hunter';

    expect(parseProxies(list)).toEqual([
      'http://alice:secret@one.example:8080',
      'http://bob:hunter@two.example:9090',
    ]);
  });

  it('reads proxies separated by commas', () => {
    const list = 'one.example:8080:alice:secret,two.example:9090:bob:hunter';

    expect(parseProxies(list)).toEqual([
      'http://alice:secret@one.example:8080',
      'http://bob:hunter@two.example:9090',
    ]);
  });

  it('skips blank lines and the spaces around an entry', () => {
    const list = '\n  one.example:8080:alice:secret  \n\n,\n';

    expect(parseProxies(list)).toEqual([
      'http://alice:secret@one.example:8080',
    ]);
  });

  it('finds no proxies in an empty list', () => {
    expect(parseProxies('')).toEqual([]);
  });

  it('encodes a username and password that would break the address', () => {
    expect(parseProxies('one.example:8080:al/ice:p@ss')).toEqual([
      'http://al%2Fice:p%40ss@one.example:8080',
    ]);
  });

  it.each([
    'one.example:8080',
    'one.example:8080:alice',
    'one.example:8080:alice:secret:extra',
    ':8080:alice:secret',
    'one.example::alice:secret',
  ])('refuses the malformed entry %s', entry => {
    expect(() => parseProxies(entry)).toThrow(MALFORMED_PROXY);
  });

  it('refuses the whole list when one entry is malformed', () => {
    const list = 'one.example:8080:alice:secret\ntwo.example';

    expect(() => parseProxies(list)).toThrow(MALFORMED_PROXY);
  });
});
