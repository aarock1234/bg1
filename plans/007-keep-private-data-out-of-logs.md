# Plan 007: Logs never carry Disney's answers, guest data or database parameters

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7be6d38..HEAD -- src/api/client.ts src/api/ll/booking.ts src/api/ll/wdw.ts src/components/LoginForm.tsx server/jobs/runner.ts server/jobs/routes.ts server/jobs/worker.ts server/http/app.ts server/http/relay.ts server/main.ts`
> Plans 001 and 006 touch some of these files; that is expected. For every
> other difference, compare the excerpts below with the live code.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (apply after 001 and 006 if they are pending, to avoid editing the same files twice)
- **Category**: security
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

The server books on behalf of guests and holds their names, Disney ids, push
subscriptions and encrypted logins. Its logs are kept by the hosting
provider. The code already intends to keep that data out of logs (a helper in
the job runner says so), but three paths go around it: errors that carry
Disney's whole response in their message, shared code that prints errors with
`console.error` while running on the server, and database errors whose
message and properties contain the failed query's parameters.

## Current state

**Disney's answer inside the error message.** `src/api/client.ts:53-62`:

```ts
export class RequestError extends Error {
  name = 'RequestError';

  constructor(
    public response: JsonResponse,
    message = 'Request failed'
  ) {
    super(`${message}: ${JSON.stringify(response)}`);
  }
}
```

The message, and so the stack, contains the full response body. The response
stays available as `error.response` for code that needs it.

**Shared code printing errors on the server.** Both run inside a server job:

- `src/api/ll/booking.ts:22-30`, when cancelling unchosen guests fails:

  ```ts
    } catch (error) {
      // The booking itself succeeded, so it is returned with every guest it
      // still covers.
      console.error(error);

      return booking;
    }
  ```

- `src/api/ll/wdw.ts:273-280`, when moving an offer to the expected time
  fails:

  ```ts
      try {
        return await this.changeOfferTime(offer, expectedTime);
      } catch (error) {
        // The original offer is still good.
        console.error(error);
      }
  ```

`src/fetch.ts:139` also calls `console.error(error)`, but that error is a
network failure with no response body; leave it.

**The runner's helper, the pattern to reuse.** `server/jobs/runner.ts:122-142`:

```ts
// Describes an error for the log without repeating Disney's answer, which
// can name the guests.
function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof RequestError) {
    return {
      errorName: error.name,
      status: error.response.status,
    };
  }

  if (error instanceof Error) {
    return {
      errorName: error.name,
      stack: error.stack,
    };
  }

  return {
    errorName: 'unknown',
  };
}
```

A drizzle query failure is an `Error` whose message is
`Failed query: <sql>\nparams: <params>` and which has `query` and `params`
properties and a `cause` (the Postgres error, with a `code`). Its stack
therefore contains the parameters, and logging it as `err: error` makes
pino's serializer emit them as well.

**Sites that log a raw error on the server** (find them all with
`grep -rn "err: error\|stack: error" server`):

- `server/jobs/routes.ts` `onError`: `stack: error.stack`
- `server/jobs/worker.ts`: `err: error` in `'claiming jobs failed'`
- `server/http/app.ts` `onError`: `err: error` in `'request failed'`
- `server/http/relay.ts`: `err: error` in `'relayed request failed'`
- `server/main.ts`: `err: error` in three places
- `server/jobs/runner.ts`: `describeError` itself, for the generic `Error`
  case

**A leftover diagnostic.** `src/components/LoginForm.tsx:57-59`:

```ts
// Temporary: shows which fields Disney's login provides (names only), to
// find out whether a login can be refreshed. Remove once that is known.
console.info('oneid token fields:', Object.keys(token).join(', '));
```

It prints field names only, never values. The question it answered is
settled: the login carries a refresh token.

## Scope

**In scope**:

- `src/api/client.ts` (only `RequestError`)
- `src/api/ll/booking.ts`, `src/api/ll/wdw.ts` (only the two `catch` blocks)
- `src/components/LoginForm.tsx` (only the three lines above)
- `server/log/` or wherever `logger` lives: add one module for describing
  errors (find it with `grep -rn "export const logger" server`)
- `server/jobs/runner.ts`, `server/jobs/routes.ts`, `server/jobs/worker.ts`,
  `server/http/app.ts`, `server/http/relay.ts`, `server/main.ts`: only their
  error logging
- An existing test only if it asserts on `RequestError`'s message text

**Out of scope**:

- `src/fetch.ts`.
- Any `console.error` in React components or hooks: those run only in the
  guest's own browser.
- What is logged on success (`'probe finished'`, `'job created'`).

## Steps

### Step 1: Keep the answer out of the message

In `RequestError`, make the message carry the status only, for example
`Request failed: status 410`. Keep the `response` property and the optional
`message` parameter. Add a one-line comment saying the body stays on
`response` because messages end up in logs.

**Verify**: `pnpm test src/api` → all pass. If a test compared the message
text, update it and note it in your report.

### Step 2: Stop printing the two errors in shared code

In `booking.ts` and `wdw.ts`, replace `console.error(error)` with a log that
cannot carry a response body. These files run in the browser and on the
server and must not import server code, so log a fixed lowercase message and
the status only. Add one small exported helper next to `RequestError` in
`src/api/client.ts`:

```ts
// The HTTP status behind a failed request, or undefined for any other error.
export function requestStatus(error: unknown): number | undefined {
  if (error instanceof RequestError) {
    return error.response.status;
  }

  return undefined;
}
```

`src/api/ll/auto-book.ts` has a private function of the same name and body;
delete it there and import this one, so the code exists once.

Then, for example in `booking.ts`:

```ts
console.warn('cancelling unchosen guests failed', requestStatus(error));
```

`src/api/ll.test.ts:434` asserts `console.error` was called with `'oops'` for
one of these paths; update that assertion to the new call and say so in your
report.

**Verify**: `pnpm test src/api` → all pass.
`grep -n "console.error(error)" src/api/ll/booking.ts src/api/ll/wdw.ts` → no
matches.

### Step 3: One way to describe an error on the server

Move `describeError` out of `server/jobs/runner.ts` into its own module
beside the logger (name the file for what it does, such as
`server/log/describe-error.ts`; match how the logger's module is laid out)
and export it. Extend it:

- For a `RequestError`: name and status, as today.
- For a database query failure: name, plus the `code` of its `cause` when
  that is a string. Never the message, stack, `query` or `params`. Detect it
  structurally (an `Error` that has a `query` property) with a small type
  guard, so no drizzle internals are imported; say why in a comment.
- For any other `Error`: name and stack, as today.
- Otherwise `errorName: 'unknown'`.

Give the return type a name instead of `Record<string, unknown>`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Use it everywhere the server logs an error

Replace every `err: error` and `stack: error.stack` found by the grep above
with `...describeError(error)`. In `server/jobs/routes.ts` that also replaces
`errorName: error.name`.

**Verify**: `grep -rn "err: error\|error.stack" server` → the only match is
inside the new module. `pnpm typecheck` → exit 0.

### Step 5: Remove the leftover diagnostic

Delete the comment and the `console.info` in `LoginForm.tsx`.

**Verify**: `grep -rn "oneid token fields" src` → no matches.
`pnpm checkall` → all pass. `pnpm build` → exit 0.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Plan 012 lists `describeError` as
a pure unit worth covering: a query failure must never yield its parameters.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "JSON.stringify(response)" src/api/client.ts` returns nothing
- [ ] `grep -rn "err: error" server` returns nothing
- [ ] `grep -rn "function requestStatus" src` returns exactly one line
- [ ] `grep -rn "oneid token fields" src` returns nothing
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- Code somewhere reads `RequestError`'s message to make a decision
  (`grep -rn "\.message" src/api src/hooks src/components | grep -v test`
  and read each hit).
- The logger is configured with pino serializers that already redact these
  fields; then report instead of duplicating.

## Maintenance notes

- New server code must log errors through `describeError`. A reviewer seeing
  `err: error` in `server/` should ask for it.
- Debugging loses Disney's response bodies. When one is needed, log specific,
  known-safe fields at the call site instead of the whole body.
