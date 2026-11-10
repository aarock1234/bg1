import { HOSTS } from '@/config';
import { fetchJson } from '@/fetch';
import kvdb from '@/kvdb';

import type { ProbeReport, ProbeRequest } from '../../server/probe/probe';

export type { ProbeReport, ProbeRequest };

const SECRET_KEY = 'bg1.server.secret';

// How long the server may take to finish every check in a probe.
const PROBE_TIMEOUT_MS = 60_000;

export class ServerRequestFailed extends Error {
  readonly name = 'ServerRequestFailed';

  constructor(readonly status: number) {
    super(`BG1 server request failed with status ${status}`);
  }
}

// The secret that lets this device use the BG1 server, entered once and kept
// in the browser.
export const serverSecret = {
  get(): string | undefined {
    const secret = kvdb.get(SECRET_KEY);

    return typeof secret === 'string' && secret !== '' ? secret : undefined;
  },

  set(secret: string): void {
    kvdb.set(SECRET_KEY, secret.trim());
  },

  clear(): void {
    kvdb.delete(SECRET_KEY);
  },
};

async function post<T>(
  path: string,
  secret: string,
  data: unknown,
  timeoutMs?: number
): Promise<T> {
  const response = await fetchJson<T>(`${HOSTS.HOME}/api/${path}`, {
    data,
    timeoutMs,
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  if (!response.ok) {
    throw new ServerRequestFailed(response.status);
  }

  return response.data;
}

// Asks the server to check, with this guest's login, whether Disney accepts
// requests from it.
export function runProbe(
  secret: string,
  request: ProbeRequest
): Promise<ProbeReport> {
  return post<ProbeReport>('probe', secret, request, PROBE_TIMEOUT_MS);
}
