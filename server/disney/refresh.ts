import { z } from 'zod';

import type { ResortId } from '@/api/resort';

import { accessTokenClaims } from './access-token';
import type { DisneyLogin } from './credentials';

const ONE_ID_ORIGIN = 'https://registerdisney.go.com';
const REQUEST_TIMEOUT_MS = 15_000;
const MS_PER_SECOND = 1000;

// Timestamps below this are in seconds; anything larger is in milliseconds.
const LARGEST_TIMESTAMP_IN_SECONDS = 100_000_000_000;

// A client ID may only contain what OneID's own IDs do, since it becomes part
// of the request path.
const CLIENT_ID_PATTERN = /^[A-Za-z0-9.-]+$/;

const timestampSchema = z.union([z.number().positive(), z.string().min(1)]);

// What OneID answers a refresh with. The fields beyond the access token vary
// between OneID versions, so each one is optional and has a fallback.
const refreshResponseSchema = z.object({
  data: z.object({
    token: z.object({
      access_token: z.string().min(1),
      refresh_token: z.string().min(1).optional(),
      swid: z.string().min(1).optional(),

      // How long the tokens last, in seconds.
      ttl: z.number().positive().optional(),
      refresh_ttl: z.number().positive().optional(),

      // When the tokens expire.
      exp: timestampSchema.optional(),
      refresh_exp: timestampSchema.optional(),
    }),
  }),
});

type RefreshedToken = z.infer<typeof refreshResponseSchema>['data']['token'];

const errorResponseSchema = z.object({
  error: z.object({
    errors: z
      .array(
        z.object({
          code: z.string(),
        })
      )
      .min(1),
  }),
});

export type RefreshOptions = {
  // Sends the requests in place of the global fetch, such as through a proxy.
  fetch?: typeof fetch;
};

// The login could not be refreshed. `reason` never contains a token.
export class LoginRefreshFailed extends Error {
  readonly name = 'LoginRefreshFailed';

  constructor(
    readonly reason: string,
    options?: ErrorOptions
  ) {
    super(`login refresh failed: ${reason}`, options);
  }
}

// Whether the login carries a refresh token that is still valid.
export function canRefresh(login: DisneyLogin, now = Date.now()): boolean {
  if (login.refreshToken === undefined) {
    return false;
  }

  return login.refreshExpires === undefined || login.refreshExpires > now;
}

// The OneID client the login belongs to. The access token names it when it
// is a JWT; otherwise it is the client BG1's login form uses on iOS, with the
// suffix OneID adds for its production environment.
function clientIdFor(login: DisneyLogin, resortId: ResortId): string {
  const claimedClientId = accessTokenClaims(login.accessToken).client_id;

  if (claimedClientId && CLIENT_ID_PATTERN.test(claimedClientId)) {
    return claimedClientId;
  }

  return `TPR-${resortId}-LBSDK.IOS-PROD`;
}

function toTimestampMs(value: number | string): number | undefined {
  if (typeof value === 'string') {
    const timestampMs = new Date(value).getTime();

    return Number.isNaN(timestampMs) ? undefined : timestampMs;
  }

  return value < LARGEST_TIMESTAMP_IN_SECONDS ? value * MS_PER_SECOND : value;
}

// Works out when a token expires from whichever field OneID provided: its
// lifetime, or the moment it ends.
function expiryMs(
  ttlSeconds: number | undefined,
  expiresAt: number | string | undefined,
  now: number
): number | undefined {
  if (ttlSeconds !== undefined) {
    return now + ttlSeconds * MS_PER_SECOND;
  }

  if (expiresAt !== undefined) {
    return toTimestampMs(expiresAt);
  }

  return undefined;
}

function accessTokenExpiryMs(token: RefreshedToken, now: number): number {
  const jwtExpiry = accessTokenClaims(token.access_token).exp;
  const expires =
    expiryMs(token.ttl, token.exp, now) ??
    (jwtExpiry === undefined ? undefined : jwtExpiry * MS_PER_SECOND);

  if (expires === undefined || expires <= now) {
    throw new LoginRefreshFailed('the new login has no usable expiry');
  }

  return expires;
}

function toLogin(
  token: RefreshedToken,
  previous: DisneyLogin,
  now: number
): DisneyLogin {
  if (token.swid !== undefined && token.swid !== previous.swid) {
    throw new LoginRefreshFailed('the new login is for another account');
  }

  return {
    swid: previous.swid,
    accessToken: token.access_token,
    expires: accessTokenExpiryMs(token, now),

    // OneID may keep the refresh token it was given instead of issuing a new
    // one.
    refreshToken: token.refresh_token ?? previous.refreshToken,
    refreshExpires:
      expiryMs(token.refresh_ttl, token.refresh_exp, now) ??
      previous.refreshExpires,
  };
}

async function post(
  url: string,
  init: RequestInit,
  options: RefreshOptions
): Promise<Response> {
  const sendRequest = options.fetch ?? fetch;

  try {
    return await sendRequest(url, {
      ...init,
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new LoginRefreshFailed('oneid could not be reached', {
      cause: error,
    });
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

// OneID hands out a short-lived key that its other requests must carry.
async function requestApiKey(
  clientId: string,
  options: RefreshOptions
): Promise<string> {
  const response = await post(
    `${ONE_ID_ORIGIN}/jgc/v8/client/${clientId}/api-key?langPref=en-US`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'null',
    },
    options
  );
  const apiKey = response.headers.get('api-key');

  // The body isn't needed, but leaving it unread would keep the connection
  // open.
  await response.body?.cancel();

  if (!response.ok || !apiKey) {
    throw new LoginRefreshFailed(
      `oneid gave no api key (status ${response.status})`
    );
  }

  return apiKey;
}

// Describes OneID's refusal by its status and error code, neither of which
// reveals anything about the guest.
function refusalReason(status: number, body: unknown): string {
  const parsed = errorResponseSchema.safeParse(body);
  const code = parsed.success ? parsed.data.error.errors[0]?.code : undefined;

  return `oneid answered ${status} ${code ?? 'without an error code'}`;
}

// Trades the login's refresh token for a new login with a later expiry. This
// follows what OneID's own script does; Disney doesn't document it. Throws
// LoginRefreshFailed when it doesn't work for any reason.
export async function refreshLogin(
  login: DisneyLogin,
  resortId: ResortId,
  options: RefreshOptions = {}
): Promise<DisneyLogin> {
  if (!canRefresh(login)) {
    throw new LoginRefreshFailed('the login has no valid refresh token');
  }

  const clientId = clientIdFor(login, resortId);
  const apiKey = await requestApiKey(clientId, options);

  const response = await post(
    `${ONE_ID_ORIGIN}/jgc/v8/client/${clientId}/guest/refresh-auth?langPref=en-US`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `APIKEY ${apiKey}`,
      },
      body: JSON.stringify({
        refreshToken: login.refreshToken,
      }),
    },
    options
  );
  const body = await readJson(response);

  if (!response.ok) {
    throw new LoginRefreshFailed(refusalReason(response.status, body));
  }

  const parsed = refreshResponseSchema.safeParse(body);

  if (!parsed.success) {
    throw new LoginRefreshFailed('oneid answered in an unexpected shape');
  }

  return toLogin(parsed.data.data.token, login, Date.now());
}
