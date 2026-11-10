import { HOSTS } from '@/config';
import { fetchJson } from '@/fetch';

import type { ProbeReport, ProbeRequest } from '../../server/probe/probe';

export type { ProbeReport, ProbeRequest };

// How long the server may take to finish every check in a probe.
const PROBE_TIMEOUT_MS = 60_000;

export class ServerRequestFailed extends Error {
  readonly name = 'ServerRequestFailed';

  constructor(readonly status: number) {
    super(`BG1 server request failed with status ${status}`);
  }
}

async function post<T>(
  path: string,
  data: unknown,
  timeoutMs?: number
): Promise<T> {
  const response = await fetchJson<T>(`${HOSTS.HOME}/api/${path}`, {
    data,
    timeoutMs,
  });

  if (!response.ok) {
    throw new ServerRequestFailed(response.status);
  }

  return response.data;
}

// Asks the server to check, with this guest's login, whether Disney accepts
// requests from it.
export function runProbe(request: ProbeRequest): Promise<ProbeReport> {
  return post<ProbeReport>('probe', request, PROBE_TIMEOUT_MS);
}
