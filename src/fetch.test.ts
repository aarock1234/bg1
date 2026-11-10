import { fetchJson } from './fetch';

jest.useFakeTimers();
self.fetch = jest.fn();

function mockFetch(body: any, headers: { [name: string]: string } = {}) {
  headers = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: () => body,
  } as Response);
}

const url = 'https://example.com/';
const signal = expect.any(AbortSignal);
const init = {
  headers: {},
  cache: 'no-store',
  credentials: 'omit',
  referrer: '',
  signal,
};

// Returns the arguments of the latest fetch call, with its Headers instance
// converted to a plain object so that it can be compared.
function lastFetchCall() {
  const [requestUrl, requestInit = {}] = jest.mocked(fetch).mock.lastCall ?? [];
  const headers = new Headers(requestInit.headers);

  return [
    requestUrl,
    {
      ...requestInit,
      headers: Object.fromEntries(headers.entries()),
    },
  ];
}

describe('fetchJson()', () => {
  beforeEach(() => {
    jest.advanceTimersByTime(10);
  });

  it('returns response', async () => {
    mockFetch({ a: 1 }, { 'content-type': 'application/json' });
    expect(await fetchJson(url)).toEqual({
      ok: true,
      status: 200,
      data: { a: 1 },
    });
  });

  it('returns empty data object for non-JSON response', async () => {
    mockFetch(null);
    expect(await fetchJson(url)).toEqual({ ok: true, status: 200, data: {} });
  });

  it('uses POST if method not specified and data included', async () => {
    const data = { name: 'Mickey' };
    await fetchJson(url, { data });
    expect(lastFetchCall()).toEqual([
      url,
      {
        method: 'POST',
        body: JSON.stringify(data),
        ...init,
        headers: {
          ...init.headers,
          'content-type': 'application/json',
        },
      },
    ]);
  });

  it('adds params to URL', async () => {
    await fetchJson(url, { params: { start: 5, end: 15 } });
    expect(lastFetchCall()).toEqual([
      `${url}?start=5&end=15`,
      {
        ...init,
        method: 'GET',
      },
    ]);
  });

  it('returns status=0 response on timeout', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => null);
    const timeoutMs = 5000;
    jest.mocked(fetch).mockImplementationOnce(((
      url: string,
      init: RequestInit
    ) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (init.signal?.aborted) {
            reject('aborted');
          } else {
            resolve({ ok: true, status: 200 } as Response);
          }
        }, timeoutMs);
      });
    }) as typeof fetch);
    const promise = fetchJson(url, { timeoutMs });
    jest.advanceTimersByTime(timeoutMs);
    expect(await promise).toEqual({ ok: false, status: 0, data: null });
  });
});
