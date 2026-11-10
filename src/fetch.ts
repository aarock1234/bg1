const DEFAULT_TIMEOUT_MS = 8000;

// React StrictMode runs effects twice in development; identical requests made
// within this window share one response.
const DEDUPE_WINDOW_MS = 10;

export type JsonOK<T = unknown> = {
  ok: true;
  status: number;
  data: T;
};

export type JsonFailure = {
  ok: false;
  status: number;
  data: unknown;
};

export type JsonResponse<T = unknown> = JsonOK<T> | JsonFailure;

export type QueryParams = Record<string, string | number>;

export type FetchJsonOptions = RequestInit & {
  params?: QueryParams;
  data?: unknown;
  timeoutMs?: number;

  // Sends the request in place of the global fetch, such as through a proxy.
  fetch?: typeof fetch;
};

type PreparedRequest = {
  url: string;
  init: RequestInit;
  timeoutMs: number;
  fetch: typeof fetch;
};

const pendingResponses = new Map<string, Promise<JsonResponse>>();

// Fetches a URL and parses a JSON response. A network failure, a timeout, or
// a body that can't be read resolves to a failure with status 0 instead of
// rejecting.
export function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<JsonResponse<T>> {
  const {
    params,
    data,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetch: sendRequest = fetch,
    ...init
  } = options;
  const headers = new Headers(init.headers);
  const body = data ? JSON.stringify(data) : undefined;
  const method = init.method ?? (data ? 'POST' : 'GET');

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const request: PreparedRequest = {
    url: withQueryParams(url, params),
    init: {
      ...init,
      referrer: init.referrer ?? '',
      credentials: init.credentials ?? 'omit',
      cache: init.cache ?? 'no-store',
      method,
      headers,
      body,
    },
    timeoutMs,
    fetch: sendRequest,
  };

  // Only requests that are identical, down to who is asking, are the same
  // request.
  const dedupeKey = [
    method,
    request.url,
    headers.get('Authorization') ?? '',
    body ?? '',
  ].join('\n');

  const response = dedupe(dedupeKey, () => send(request));

  return response as Promise<JsonResponse<T>>;
}

function withQueryParams(url: string, params: QueryParams = {}): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([name, value]) => {
      return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  if (!query) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}${query}`;
}

function dedupe(
  key: string,
  request: () => Promise<JsonResponse>
): Promise<JsonResponse> {
  const pending = pendingResponses.get(key);

  if (pending) {
    return pending;
  }

  const response = request();
  pendingResponses.set(key, response);
  setTimeout(() => pendingResponses.delete(key), DEDUPE_WINDOW_MS);

  return response;
}

async function send(request: PreparedRequest): Promise<JsonResponse> {
  // Browsers refuse to run their fetch as a method of another object, so it
  // is taken out of the request before being called.
  const { url, init, timeoutMs, fetch: sendRequest } = request;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // The timeout covers the body as well: a response whose headers arrive but
  // whose body stalls or is cut off fails like any other lost connection.
  try {
    const response = await sendRequest(url, {
      ...init,
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      data: await parseJsonBody(response),
    };
  } catch (error) {
    console.error(error);

    return {
      ok: false,
      status: 0,
      data: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') ?? '';

  if (!contentType.startsWith('application/json')) {
    return {};
  }

  return response.json();
}
