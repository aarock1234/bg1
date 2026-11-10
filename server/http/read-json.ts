import type { Context } from 'hono';

// Returns undefined for a body that isn't JSON, which then fails validation
// like any other malformed request.
export async function readJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}
