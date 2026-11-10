import { HOSTS } from '@/config';
import { fetchJson } from '@/fetch';

import type { PushPublicKeyResponse } from '../../server/http/app';
import type { CreateJobRequest } from '../../server/jobs/create';
import type { JobView } from '../../server/jobs/public-view';
import type { CreateJobResponse, JobResponse } from '../../server/jobs/routes';
import type { ProbeReport, ProbeRequest } from '../../server/probe/probe';

export type {
  CreateJobRequest,
  CreateJobResponse,
  JobView,
  ProbeReport,
  ProbeRequest,
};

// How long the server may take to finish every check in a probe.
const PROBE_TIMEOUT_MS = 60_000;

// The server loads the resort's data before it answers a new search. Giving
// up too soon would leave a search running whose token never arrived, which
// the device couldn't stop.
const CREATE_JOB_TIMEOUT_MS = 30_000;

type ServerRequest = {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  data?: unknown;
  timeoutMs?: number;

  // The token of the job the request is about.
  jobToken?: string;
};

// The server turned a request down. `code` is the stable code it gave for
// the reason, when it gave one.
export class ServerRequestFailed extends Error {
  readonly name = 'ServerRequestFailed';

  constructor(
    readonly status: number,
    readonly code?: string
  ) {
    super(`BG1 server request failed with status ${status}`);
  }
}

function errorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('code' in body)) {
    return undefined;
  }

  return typeof body.code === 'string' ? body.code : undefined;
}

async function request<T>(serverRequest: ServerRequest): Promise<T> {
  const { path, method, data, timeoutMs, jobToken } = serverRequest;
  const headers: Record<string, string> = {};

  if (jobToken !== undefined) {
    headers.Authorization = `Bearer ${jobToken}`;
  }

  const response = await fetchJson<T>(`${HOSTS.HOME}/api/${path}`, {
    method,
    data,
    timeoutMs,
    headers,
  });

  if (!response.ok) {
    throw new ServerRequestFailed(response.status, errorCode(response.data));
  }

  return response.data;
}

// Asks the server to check, with this guest's login, whether Disney accepts
// requests from it.
export function runProbe(probeRequest: ProbeRequest): Promise<ProbeReport> {
  return request<ProbeReport>({
    path: 'probe',
    data: probeRequest,
    timeoutMs: PROBE_TIMEOUT_MS,
  });
}

// Hands a search over to the server, which keeps looking for a Lightning
// Lane after the app is closed. The token in the answer is the only way to
// check on or cancel the job, so the caller has to keep it.
export function createJob(
  jobRequest: CreateJobRequest
): Promise<CreateJobResponse> {
  return request<CreateJobResponse>({
    path: 'jobs',
    data: jobRequest,
    timeoutMs: CREATE_JOB_TIMEOUT_MS,
  });
}

export async function getJob(id: string, jobToken: string): Promise<JobView> {
  const { job } = await request<JobResponse>({
    path: `jobs/${encodeURIComponent(id)}`,
    jobToken,
  });

  return job;
}

// Stops a search. Returns the job as it is afterward: a search that had
// already ended stays as it ended.
export async function cancelJob(
  id: string,
  jobToken: string
): Promise<JobView> {
  const { job } = await request<JobResponse>({
    path: `jobs/${encodeURIComponent(id)}`,
    method: 'DELETE',
    jobToken,
  });

  return job;
}

// Returns the key to subscribe to the server's push notifications with, as
// `pushManager.subscribe` takes it for `applicationServerKey`.
export async function pushPublicKey(): Promise<string> {
  const { publicKey } = await request<PushPublicKeyResponse>({
    path: 'push/public-key',
  });

  return publicKey;
}
