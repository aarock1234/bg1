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
};

const pendingResponses = new Map<string, Promise<JsonResponse>>();

// Fetches a URL and parses a JSON response. A network failure or timeout
// resolves to a failure with status 0 instead of rejecting.
export function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<JsonResponse<T>> {
  const { params, data, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const headers = new Headers(init.headers);
  const request: RequestInit = {
    ...init,
    referrer: init.referrer ?? '',
    credentials: init.credentials ?? 'omit',
    cache: init.cache ?? 'no-store',
    method: init.method ?? (data ? 'POST' : 'GET'),
    headers,
  };

  if (data) {
    headers.set('Content-Type', 'application/json');
    request.body = JSON.stringify(data);
  }

  const requestUrl = withQueryParams(url, params);
  const dedupeKey = `${request.method}${requestUrl}`;

  const response = dedupe(dedupeKey, () =>
    send(requestUrl, request, timeoutMs)
  );

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

async function send(
  url: string,
  request: RequestInit,
  timeoutMs: number
): Promise<JsonResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(url, {
      ...request,
      signal: controller.signal,
    });
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

  return {
    ok: response.ok,
    status: response.status,
    data: await parseJsonBody(response),
  };
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') ?? '';

  if (!contentType.startsWith('application/json')) {
    return {};
  }

  return response.json();
}
