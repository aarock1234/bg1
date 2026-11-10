import { JsonOK, JsonResponse, fetchJson } from '@/fetch';
import { RateLimit } from '@/ratelimit';

import { Auth, authStore } from './auth';
import { RESORT_IDS, Resort, ResortId } from './resort';
import { type SensorDataSource, sensorData } from './sensor-data';

// The version of the official Disney app that BG1 identifies itself as.
export const APP_VERSION = '8.23.3';

const REQUESTS_PER_SECOND = 5;

const STATUS_NETWORK_FAILURE = 0;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_BAD_GATEWAY = 502;

export type ApiRequest = {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, string>;
  data?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;

  // Keeps the stored login when the request is rejected as unauthorized.
  ignoreUnauth?: boolean;

  // Sends the bot-protection token that booking endpoints require.
  sensorData?: boolean;
};

export type ApiClientOptions = {
  // The guest's Disney login. Defaults to the one stored in the browser.
  auth?: Auth;

  // Sends the client's requests, such as through a proxy. Defaults to the
  // global fetch.
  fetch?: typeof fetch;

  rateLimit?: RateLimit;

  // Supplies bot-protection tokens. Defaults to fetching them straight from
  // the BG1 backend.
  sensorData?: SensorData;
};

type SensorData = Pick<SensorDataSource, 'get' | 'reset'>;

export class InvalidOrigin extends Error {
  name = 'InvalidOrigin';
}

export class RequestError extends Error {
  name = 'RequestError';

  // The message gives the status only. Messages end up in logs, and Disney's
  // answer, which can name guests, stays on `response`.
  constructor(
    public response: JsonResponse,
    message = 'Request failed'
  ) {
    super(`${message}: status ${response.status}`);
  }
}

// The HTTP status behind a failed request, or undefined for any other error.
export function requestStatus(error: unknown): number | undefined {
  if (error instanceof RequestError) {
    return error.response.status;
  }

  return undefined;
}

export abstract class ApiClient {
  protected resort: Resort;
  protected origin: string;
  protected auth: Auth;
  protected fetch: typeof fetch | undefined;
  protected rateLimit: RateLimit;
  protected sensorData: SensorData;

  protected static origins: Record<ResortId, string> = {
    WDW: 'https://disneyworld.disney.go.com',
    DLR: 'https://disneyland.disney.go.com',
  };

  // The Disney sites this kind of client talks to, which are also the pages
  // BG1 runs on.
  static get allOrigins(): string[] {
    return Object.values(this.origins);
  }

  static originToResortId(origin: string): ResortId {
    const resortId = RESORT_IDS.find(id => this.origins[id] === origin);

    if (!resortId) {
      throw new InvalidOrigin(origin);
    }

    return resortId;
  }

  constructor(resort: Resort, options: ApiClientOptions = {}) {
    const { origins } = this.constructor as typeof ApiClient;

    this.resort = resort;
    this.origin = origins[resort.id];
    this.auth = options.auth ?? authStore;
    this.fetch = options.fetch;
    this.sensorData = options.sensorData ?? sensorData;
    this.rateLimit = options.rateLimit ?? new RateLimit(REQUESTS_PER_SECOND);
  }

  protected async request<T>(request: ApiRequest): Promise<JsonOK<T>> {
    this.rateLimit.enforce();

    const { swid, accessToken } = this.auth.getData();
    const sensorDataHeaders = request.sensorData
      ? await this.sensorDataHeaders()
      : {};

    const response = await fetchJson<T>(this.origin + request.path, {
      method: request.method,
      params: request.params,
      data: request.data,
      timeoutMs: request.timeoutMs,
      fetch: this.fetch,
      headers: {
        'Accept-Language': 'en-US',
        Authorization: `BEARER ${accessToken}`,
        'x-user-id': swid,
        ...sensorDataHeaders,
        ...request.headers,
      },
    });

    if (response.ok) {
      return response;
    }

    this.handleFailure(request, response.status);

    throw new RequestError(response);
  }

  protected async sensorDataHeaders(): Promise<Record<string, string>> {
    return {
      'x-acf-sensor-data': await this.sensorData.get(),
      'x-app-id': `${this.resort.id}-IOS-${APP_VERSION}`,
    };
  }

  protected handleFailure(request: ApiRequest, status: number): void {
    if (status === STATUS_UNAUTHORIZED && !request.ignoreUnauth) {
      setTimeout(() => this.auth.deleteData());
      return;
    }

    // Disney answers a rejected sensor token with 403 or drops the connection.
    // On BG1's own site a dropped connection arrives as the relay's 502.
    const isSensorDataRejected =
      status === STATUS_FORBIDDEN ||
      status === STATUS_NETWORK_FAILURE ||
      status === STATUS_BAD_GATEWAY;

    if (request.sensorData && isSensorDataRejected) {
      this.sensorData.reset();
    }
  }
}
