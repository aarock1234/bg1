import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

// What the API answers a failed request with. `code` is stable and meant for
// programs; `error` is a sentence meant for people.
export type ApiErrorBody = {
  error: string;
  code: string;
  issues?: string[];
};

// A request the API turns down, with the answer to give.
export class ApiError extends Error {
  readonly name = 'ApiError';

  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly issues?: string[]
  ) {
    super(message);
  }
}

export function invalidRequest(error: z.ZodError): ApiError {
  const issues = error.issues.map(issue => {
    const path = issue.path.join('.');

    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return new ApiError(400, 'invalid_request', 'invalid request', issues);
}

export function errorResponse(context: Context, error: ApiError): Response {
  const body: ApiErrorBody = {
    error: error.message,
    code: error.code,
    issues: error.issues,
  };

  return context.json(body, error.status);
}
