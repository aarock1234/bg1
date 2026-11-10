import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

import { ApiError, errorResponse, invalidRequest } from '../http/api-error';
import { rateLimit } from '../http/rate-limit';
import { logger } from '../log';
import {
  JobRejected,
  RejectionCode,
  createJob,
  createJobRequestSchema,
} from './create';
import type { Job } from './job';
import { type JobView, toJobView } from './public-view';
import { cancelJob, findJob } from './repository';
import { matchesTokenHash } from './token';
import type { Worker } from './worker';

const ONE_MINUTE_MS = 60_000;

// How often one visitor may start a search.
const CREATE_RATE_LIMIT = {
  limit: 20,
  windowMs: ONE_MINUTE_MS,
};

// How often one visitor may look at or cancel searches. The app checks on a
// running search every few seconds.
const READ_RATE_LIMIT = {
  limit: 240,
  windowMs: ONE_MINUTE_MS,
};

// A request to start a search holds a login and a party of guests, which
// stay far below this.
const MAX_REQUEST_BYTES = 64 * 1024;

const BEARER_PREFIX = 'Bearer ';

const STATUS_UNPROCESSABLE = 422;
const STATUS_CONFLICT = 409;

const jobIdSchema = z.uuid();

// What starting a search answers with: the job, and the token to send as
// `Authorization: Bearer <token>` when reading or cancelling it.
export type CreateJobResponse = {
  job: JobView;
  token: string;
};

export type JobResponse = {
  job: JobView;
};

type JobWorker = Pick<Worker, 'wake' | 'cancel'>;

function notFound(): ApiError {
  return new ApiError(404, 'not_found', 'no such job');
}

function unauthorized(): ApiError {
  return new ApiError(401, 'unauthorized', "this job's token is required");
}

function rejectionStatus(code: RejectionCode): ContentfulStatusCode {
  if (code === RejectionCode.TOO_MANY_JOBS) {
    return STATUS_CONFLICT;
  }

  return STATUS_UNPROCESSABLE;
}

async function readJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

// Finds the job a request names and checks that the request carries that
// job's token.
async function authorizedJob(context: Context): Promise<Job> {
  const id = jobIdSchema.safeParse(context.req.param('id'));

  if (!id.success) {
    throw notFound();
  }

  const authorization = context.req.header('Authorization') ?? '';

  if (!authorization.startsWith(BEARER_PREFIX)) {
    throw unauthorized();
  }

  const job = await findJob(id.data);

  if (!job) {
    throw notFound();
  }

  const token = authorization.slice(BEARER_PREFIX.length);

  if (!matchesTokenHash(token, job.tokenHash)) {
    throw unauthorized();
  }

  return job;
}

// The routes for auto-book jobs: starting a search, checking on it, and
// cancelling it.
export function createJobRoutes(worker: JobWorker): Hono {
  const routes = new Hono();

  routes.post(
    '/',
    rateLimit(CREATE_RATE_LIMIT),
    bodyLimit({
      maxSize: MAX_REQUEST_BYTES,
      onError: context => {
        return errorResponse(
          context,
          new ApiError(413, 'request_too_large', 'request is too large')
        );
      },
    }),
    async context => {
      const request = createJobRequestSchema.safeParse(await readJson(context));

      if (!request.success) {
        throw invalidRequest(request.error);
      }

      const { job, token } = await createJob(request.data);

      worker.wake();
      logger.info(
        {
          jobId: job.id,
          resortId: job.resortId,
          experienceId: job.experienceId,
        },
        'job created'
      );

      const response: CreateJobResponse = {
        job: toJobView(job),
        token,
      };

      return context.json(response, 201);
    }
  );

  routes.get('/:id', rateLimit(READ_RATE_LIMIT), async context => {
    const response: JobResponse = {
      job: toJobView(await authorizedJob(context)),
    };

    return context.json(response);
  });

  // Cancelling a search that has already ended changes nothing and answers
  // with the job as it is.
  routes.delete('/:id', rateLimit(READ_RATE_LIMIT), async context => {
    const { id } = await authorizedJob(context);
    const job = await cancelJob(id);

    if (!job) {
      throw notFound();
    }

    worker.cancel(id);
    logger.info(
      {
        jobId: id,
        status: job.status,
      },
      'job cancellation requested'
    );

    const response: JobResponse = {
      job: toJobView(job),
    };

    return context.json(response);
  });

  routes.onError((error, context) => {
    if (error instanceof ApiError) {
      return errorResponse(context, error);
    }

    if (error instanceof JobRejected) {
      return errorResponse(
        context,
        new ApiError(rejectionStatus(error.code), error.code, error.message)
      );
    }

    logger.error(
      {
        errorName: error.name,
        stack: error.stack,
        path: context.req.path,
      },
      'job request failed'
    );

    return errorResponse(
      context,
      new ApiError(500, 'internal_error', 'internal error')
    );
  });

  return routes;
}
