import { RequestError } from '@/api/client';

// What the log says about an error.
export type ErrorDescription = {
  errorName: string;

  // The HTTP status Disney answered a failed request with.
  status?: number;

  // The database's own code for a failed query, such as 23505.
  databaseCode?: string;

  stack?: string;
};

// A query the database refused. Its message, and so its stack, spell out the
// query's parameters, which hold guests' names and their encrypted logins.
type FailedQuery = Error & {
  query: unknown;
};

// Failed queries are recognized by their shape instead of their class, which
// the database library doesn't promise to keep.
function isFailedQuery(error: Error): error is FailedQuery {
  return 'query' in error;
}

function databaseCode(error: Error): string | undefined {
  const { cause } = error;

  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return undefined;
  }

  return typeof cause.code === 'string' ? cause.code : undefined;
}

// Describes an error for the log without repeating what it may carry about
// guests: Disney's answer to a failed request, or the parameters of a failed
// query. Every error the server logs goes through here.
export function describeError(error: unknown): ErrorDescription {
  if (error instanceof RequestError) {
    return {
      errorName: error.name,
      status: error.response.status,
    };
  }

  if (!(error instanceof Error)) {
    return {
      errorName: 'unknown',
    };
  }

  if (isFailedQuery(error)) {
    return {
      errorName: error.name,
      databaseCode: databaseCode(error),
    };
  }

  return {
    errorName: error.name,
    stack: error.stack,
  };
}
