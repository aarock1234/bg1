import { z } from 'zod';

import { RequestError } from '@/api/client';
import { RESORT_IDS, RESORT_TIME_ZONES } from '@/api/resort';
import { sensorData } from '@/api/sensor-data';
import { DateTime, parkDate } from '@/datetime';

import { llClientFor, resortFor } from '../disney/clients';
import { type DisneyLogin, disneyLoginSchema } from '../disney/credentials';
import { proxiedFetch } from '../disney/proxies';

const MS_PER_MINUTE = 60_000;
const JWT_PART_COUNT = 3;
const MS_PER_SECOND = 1000;

export const probeRequestSchema = z.object({
  resortId: z.enum(RESORT_IDS),
  login: disneyLoginSchema,
});

export type ProbeRequest = z.infer<typeof probeRequestSchema>;

type ProbeCheck = {
  name: string;
  ok: boolean;
  durationMs: number;
  detail: string;
};

// What is known about the login's lifetime. It never includes the tokens
// themselves.
type LoginLifetime = {
  expiresInMinutes: number;
  hasRefreshToken: boolean;
  refreshExpiresInMinutes?: number;

  // When the access token says it was issued and expires, if it is a JWT.
  tokenIssuedAt?: string;
  tokenExpiresAt?: string;
};

export type ProbeOptions = {
  proxyUrls: string[];
};

// A way for requests to reach Disney.
type Route = {
  name: string;
  fetch?: typeof fetch;
};

export type ProbeReport = {
  resortId: ProbeRequest['resortId'];
  checks: ProbeCheck[];
  login: LoginLifetime;
};

const jwtClaimsSchema = z.object({
  iat: z.number().optional(),
  exp: z.number().optional(),
});

function minutesUntil(timestampMs: number): number {
  return Math.round((timestampMs - Date.now()) / MS_PER_MINUTE);
}

function toIsoTime(epochSeconds: number | undefined): string | undefined {
  if (epochSeconds === undefined) {
    return undefined;
  }

  return new Date(epochSeconds * MS_PER_SECOND).toISOString();
}

// Reads the issue and expiry times from an access token that is a JWT.
// Returns an empty object for any other kind of token.
function jwtTimes(
  accessToken: string
): Pick<LoginLifetime, 'tokenIssuedAt' | 'tokenExpiresAt'> {
  const parts = accessToken.split('.');
  const [, payload] = parts;

  if (parts.length !== JWT_PART_COUNT || !payload) {
    return {};
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const claims = jwtClaimsSchema.parse(JSON.parse(json));

    return {
      tokenIssuedAt: toIsoTime(claims.iat),
      tokenExpiresAt: toIsoTime(claims.exp),
    };
  } catch {
    return {};
  }
}

function loginLifetime(login: DisneyLogin): LoginLifetime {
  return {
    expiresInMinutes: minutesUntil(login.expires),
    hasRefreshToken: login.refreshToken !== undefined,
    refreshExpiresInMinutes:
      login.refreshExpires === undefined
        ? undefined
        : minutesUntil(login.refreshExpires),
    ...jwtTimes(login.accessToken),
  };
}

// Describes a failure without repeating anything Disney sent back, which
// could include details about the guest.
function failureDetail(error: unknown): string {
  if (error instanceof RequestError) {
    return `status ${error.response.status}`;
  }

  if (error instanceof Error) {
    return error.name;
  }

  return 'unknown failure';
}

async function runCheck(
  name: string,
  check: () => Promise<string>
): Promise<ProbeCheck> {
  const startedAt = performance.now();
  let ok = true;
  let detail: string;

  try {
    detail = await check();
  } catch (error) {
    ok = false;
    detail = failureDetail(error);
  }

  return {
    name,
    ok,
    durationMs: Math.round(performance.now() - startedAt),
    detail,
  };
}

// Runs the Disney checks over one route: a request any logged-in guest can
// make, and one that also needs the bot-protection token.
async function disneyChecks(
  request: ProbeRequest,
  route: Route
): Promise<ProbeCheck[]> {
  const { resortId, login } = request;
  const resort = await resortFor(resortId);
  const ll = await llClientFor(resortId, login, {
    fetch: route.fetch,
  });
  const [park] = resort.parks;

  if (!park) {
    throw new Error(`resort ${resortId} has no parks`);
  }

  return [
    await runCheck(`plain disney request, ${route.name}`, async () => {
      const experiences = await ll.experiences(park, parkDate());

      return `${experiences.length} experiences in ${park.name}`;
    }),
    await runCheck(`protected disney request, ${route.name}`, async () => {
      const guests = await ll.guests();

      return `${guests.eligible.length} eligible and ${guests.ineligible.length} ineligible guests`;
    }),
  ];
}

// Finds out whether Disney and the sensor data service accept requests from
// wherever this server runs, using a guest's login. Disney is tried directly
// and, when proxies are configured, through one of them.
export async function probe(
  request: ProbeRequest,
  options: ProbeOptions
): Promise<ProbeReport> {
  DateTime.setTimeZone(RESORT_TIME_ZONES[request.resortId]);

  const routes: Route[] = [
    {
      name: 'direct',
    },
  ];

  if (options.proxyUrls.length > 0) {
    routes.push({
      name: 'through a proxy',
      fetch: proxiedFetch(options.proxyUrls),
    });
  }

  const checks = [
    await runCheck('sensor data service', async () => {
      const token = await sensorData.get();

      return `received a ${token.length}-character token`;
    }),
  ];

  for (const route of routes) {
    checks.push(...(await disneyChecks(request, route)));
  }

  return {
    resortId: request.resortId,
    checks,
    login: loginLifetime(request.login),
  };
}
