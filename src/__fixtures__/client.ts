import { authStore } from '@/api/auth';
import { APP_VERSION } from '@/api/client';
import { fetchJson } from '@/fetch';

jest.mock('@/fetch');

// Stands in for the token service so that no test makes a network request.
jest.mock('@/api/sensor-data', () => {
  return {
    sensorData: {
      get: async () => sensorDataToken,
      reset: () => undefined,
    },
  };
});

export const accessToken = 'ACCESS_TOKEN';
export const swid = 'SWID';
export const sensorDataToken = 'SENSOR_DATA';

jest.spyOn(authStore, 'getData').mockReturnValue({
  accessToken,
  swid,
});

type ExpectedRequest = Pick<
  NonNullable<Parameters<typeof fetchJson>[1]>,
  'method' | 'params' | 'data' | 'timeoutMs'
>;

type ExpectFetchOptions = {
  // The request carries the logged-in guest's ID in its query string.
  appendUserId?: boolean;

  // The request carries the bot-protection headers of a protected endpoint.
  sensorData?: boolean;

  nthCall?: number;
};

export function response(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    data: {
      ...data,
    },
  };
}

export function respond(...responses: ReturnType<typeof response>[]) {
  for (const jsonResponse of responses) {
    jest.mocked(fetchJson).mockResolvedValueOnce(jsonResponse);
  }
}

// Every client under test is created for the Walt Disney World fixture resort.
function sensorDataHeaders(): Record<string, string> {
  return {
    'x-acf-sensor-data': sensorDataToken,
    'x-app-id': `WDW-IOS-${APP_VERSION}`,
  };
}

export function expectFetch(
  path: string,
  request: ExpectedRequest = {},
  options: ExpectFetchOptions = {}
) {
  const { appendUserId = false, sensorData = false, nthCall = 1 } = options;
  const params = appendUserId
    ? {
        ...request.params,
        userId: swid,
      }
    : request.params;

  expect(fetchJson).toHaveBeenNthCalledWith(
    nthCall,
    expect.stringContaining(expectFetch.baseUrl + path),
    {
      method: request.method,
      params,
      data: request.data,
      timeoutMs: request.timeoutMs,
      headers: {
        'Accept-Language': 'en-US',
        Authorization: `BEARER ${accessToken}`,
        'x-user-id': swid,
        ...(sensorData ? sensorDataHeaders() : {}),
        ...expectFetch.headers,
      },
    }
  );
}

const NO_EXTRA_HEADERS: Record<string, string> = {};

expectFetch.baseUrl = 'https://disneyworld.disney.go.com';

// Headers that every request of the client under test is expected to carry.
expectFetch.headers = NO_EXTRA_HEADERS;
