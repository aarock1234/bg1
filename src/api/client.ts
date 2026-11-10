import { JsonOK, JsonResponse, fetchJson } from '@/fetch';
import { RateLimit } from '@/ratelimit';

import { authStore } from './auth';
import { RESORT_IDS, Resort, ResortId } from './resort';
import { sensorData } from './sensor-data';

// The version of the official Disney app that BG1 identifies itself as.
export const APP_VERSION = '8.23.3';

const REQUESTS_PER_SECOND = 5;

const STATUS_NETWORK_FAILURE = 0;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;

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
  rateLimit?: RateLimit;
};

export class InvalidOrigin extends Error {
  name = 'InvalidOrigin';
}

export class RequestError extends Error {
  name = 'RequestError';

  constructor(
    public response: JsonResponse,
    message = 'Request failed'
  ) {
    super(`${message}: ${JSON.stringify(response)}`);
  }
}

export abstract class ApiClient {
  protected resort: Resort;
  protected origin: string;
  protected rateLimit: RateLimit;

  protected static origins: Record<ResortId, string> = {
    WDW: 'https://disneyworld.disney.go.com',
    DLR: 'https://disneyland.disney.go.com',
  };

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
    this.rateLimit = options.rateLimit ?? new RateLimit(REQUESTS_PER_SECOND);
  }

  protected async request<T>(request: ApiRequest): Promise<JsonOK<T>> {
    this.rateLimit.enforce();

    const { swid, accessToken } = authStore.getData();
    const sensorDataHeaders = request.sensorData
      ? await this.sensorDataHeaders()
      : {};

    const response = await fetchJson<T>(this.origin + request.path, {
      method: request.method,
      params: request.params,
      data: request.data,
      timeoutMs: request.timeoutMs,
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
      'x-acf-sensor-data': await sensorData.get(),
      'x-app-id': `${this.resort.id}-IOS-${APP_VERSION}`,
    };
  }

  protected handleFailure(request: ApiRequest, status: number): void {
    if (status === STATUS_UNAUTHORIZED && !request.ignoreUnauth) {
      setTimeout(() => authStore.deleteData());
      return;
    }

    // Disney answers a rejected sensor token with 403 or drops the connection.
    const isSensorDataRejected =
      status === STATUS_FORBIDDEN || status === STATUS_NETWORK_FAILURE;

    if (request.sensorData && isSensorDataRejected) {
      sensorData.reset();
    }
  }
}
