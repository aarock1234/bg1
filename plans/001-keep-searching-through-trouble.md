# Plan 001: A server search survives trouble instead of ending on the first surprise

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7be6d38..HEAD -- src/api/ll/auto-book.ts src/api/sensor-data.ts src/fetch.ts src/api/ll/wdw.ts src/api/ll/dlr.ts server/jobs/outcome.ts server/jobs/runner.ts server/disney/clients.ts`
> If any of these changed, compare the excerpts below with the live code; a
> mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

A guest hands a search to the server and closes their phone, expecting it to
keep looking for hours. Today the search ends permanently on things that pass
by themselves: one failed fetch of a bot-protection token from a third-party
service (which every search needs about every five seconds), about two to
four minutes of Disney errors, a truncated response, or a challenge page.
After this plan only failures that retrying cannot fix end a search; the
search's time window and login expiry, which the runner already enforces, are
what bound it.

## Current state

- `src/api/ll/auto-book.ts`: the search loop. Shared code, but its only
  caller is `server/jobs/runner.ts`.
- `src/api/sensor-data.ts`: fetches the bot-protection token.
- `src/fetch.ts`: `fetchJson`, used by every client in the browser and on the
  server.
- `server/jobs/outcome.ts`: turns the error that ended a search into what the
  guest is told.
- `server/jobs/runner.ts`: runs one job; records each attempt.
- `server/disney/clients.ts`: caches resort data.

`src/api/ll/auto-book.ts:20-23` and `:250-252`, the give-up limit:

```ts
const MAX_BACKOFF_MS = 30_000;

// How many checks in a row may fail on connection trouble before giving up.
const MAX_CONSECUTIVE_FAILURES = 8;
```

```ts
if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
  throw new ConnectionLost();
}
```

`src/api/ll/auto-book.ts:118-131`, what counts as retryable. Anything that is
not a `RequestError` (a `SensorDataUnavailable`, a `TypeError` from a
malformed answer) is not, and falls through to `throw error` at line 223:

```ts
function isTransient(error: unknown): boolean {
  const status = requestStatus(error);

  if (status === undefined) {
    return false;
  }

  return (
    status === STATUS_NETWORK_FAILURE ||
    status === STATUS_FORBIDDEN ||
    status === STATUS_TOO_MANY_REQUESTS ||
    status >= STATUS_SERVER_ERROR
  );
}
```

`src/api/ll/auto-book.ts:202-224`, the classification in `attemptBooking`:

```ts
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    if (error instanceof OfferError && hasNoEligibleGuests(error.guests)) {
      throw new NoEligibleGuests(error.guests);
    }

    if (isUnavailable(error)) {
      return {
        kind: 'unavailable',
      };
    }

    if (isTransient(error)) {
      return {
        kind: 'interrupted',
      };
    }

    throw error;
  }
```

`src/api/sensor-data.ts:17-20`, no timeout:

```ts
export async function fetchTokenFromService(): Promise<string> {
  const response = await fetch(SENSOR_DATA_URL, {
    method: 'POST',
  });
```

`src/fetch.ts:133-154`: the timeout is cleared before the body is read, and
the body is parsed outside the `try`, so a stalled or truncated body hangs or
rejects instead of becoming a status 0 failure:

```ts
  try {
    response = await sendRequest(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    console.error(error);

    return {
      ok: false,
      status: 0,
      data: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    ok: response.ok,
    status: response.status,
    data: await parseJsonBody(response),
  };
```

`server/disney/clients.ts:16-25`: a failed load of resort data is cached for
the life of the process, so every later job for that resort fails:

```ts
export function resortFor(resortId: ResortId): Promise<Resort> {
  let resort = resorts.get(resortId);

  if (!resort) {
    resort = loadResort(resortId);
    resorts.set(resortId, resort);
  }

  return resort;
}
```

`server/jobs/outcome.ts:59-71`: the "nobody can book" and "connection lost"
outcomes.

`server/jobs/runner.ts:263-273`: `recordAttempt` stores each miss; it logs
nothing.

Errors that retrying cannot fix, and where they are defined:

| Error                          | From           | Why it is final                    |
| ------------------------------ | -------------- | ---------------------------------- |
| `RequestError` with status 401 | `@/api/client` | Disney no longer accepts the login |
| `ReauthNeeded`                 | `@/api/auth`   | there is no usable login           |
| `ModifyNotAllowed`             | `@/api/ll`     | the booking can't be changed       |
| `RateLimitExceeded`            | `@/ratelimit`  | the client refuses all later calls |
| `NoEligibleGuests`             | `auto-book.ts` | nobody in the party can book       |

`FailureCode.CONNECTION_LOST` in `server/jobs/job.ts:22` must stay: rows
already in the database carry it and every row read is parsed with zod.

## Scope

**In scope**:

- `src/api/ll/auto-book.ts`
- `src/api/sensor-data.ts`
- `src/fetch.ts` (and `src/fetch.test.ts` only if an existing assertion changes)
- `src/api/ll/wdw.ts` and `src/api/ll/dlr.ts`: only the `timeoutMs` of the
  booking request in `book`
- `server/jobs/outcome.ts`
- `server/jobs/runner.ts`
- `server/disney/clients.ts`

**Out of scope**:

- `server/jobs/job.ts`: do not remove `CONNECTION_LOST`.
- Which guests an offer covers and picking a later return time: plans 004 and 005.
- `src/api/client.ts`: plan 006 and 007 change it.
- New tests: plan 012 covers this file.

## Steps

### Step 1: Retry everything except what retrying cannot fix

In `src/api/ll/auto-book.ts`:

1. Replace `isTransient` with its opposite, a predicate named `isFinal` that
   returns true only for the errors in the table above (`NoEligibleGuests` is
   thrown separately and needs no entry). Import `ReauthNeeded` from
   `'../auth'`, `ModifyNotAllowed` from `'../ll'` (it is a class, so it needs
   a value import, separate from the existing `import type`), and
   `RateLimitExceeded` from `'@/ratelimit'`. Add
   `const STATUS_UNAUTHORIZED = 401;` beside the other status constants and
   delete the ones no longer used.
2. In `attemptBooking`'s `catch`, keep the order: aborted, then no eligible
   guests, then unavailable. After those, `if (isFinal(error)) { throw error; }`
   and otherwise return the interrupted miss.
3. Carry the cause on the miss so the one place that logs it can describe it.
   Change the `interrupted` member of `Miss` to:

   ```ts
   | {
       kind: 'interrupted';

       // What interrupted the check, for whoever logs it.
       error: unknown;
     };
   ```

4. Update the comments above the predicate and above `autoBook` so they
   describe the new rule: every failure is retried with backoff unless
   retrying cannot fix it.

**Verify**: `pnpm typecheck` → fails only in `server/jobs/runner.ts` if at
all (step 3 fixes it); no errors inside `auto-book.ts`.

### Step 2: Remove the give-up limit

In `src/api/ll/auto-book.ts` delete `MAX_CONSECUTIVE_FAILURES`, the
`ConnectionLost` class and the check that throws it. Keep
`consecutiveFailures`: it still drives the backoff, which `MAX_BACKOFF_MS`
caps at 30 seconds. Rewrite the comment above `DEFAULT_POLL_INTERVAL_MS`,
which still describes "the browser's client", to say what is true now.

In `server/jobs/outcome.ts` delete the `ConnectionLost` branch and its
import. Leave `FailureCode.CONNECTION_LOST` in `server/jobs/job.ts`.

**Verify**: `grep -rn "ConnectionLost\|MAX_CONSECUTIVE_FAILURES" src server` →
no matches.

### Step 3: Log each interruption once, in the runner

In `server/jobs/runner.ts`, `recordAttempt` receives the attempt. When
`attempt.kind === 'interrupted'`, log it with the run's logger before
recording it:

```ts
this.log.warn(
  {
    ...describeError(attempt.error),
    retryInMs: attempt.retryInMs,
  },
  'job check interrupted'
);
```

`describeError` already exists in that file and keeps Disney's answer out of
the log. Do not store `error` in `this.progress.lastAttempt`; that object is
saved to the database and shown to the guest.

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Give the token fetch a timeout

In `src/api/sensor-data.ts` add `const SENSOR_DATA_TIMEOUT_MS = 8000;` with a
one-line comment, and pass `signal: AbortSignal.timeout(SENSOR_DATA_TIMEOUT_MS)`
to the `fetch` in `fetchTokenFromService`.

**Verify**: `pnpm test src/api` → all pass.

### Step 5: Make the request timeout cover the response body

In `src/fetch.ts`, restructure `send` so that reading and parsing the body
happens inside the `try`, and the timeout is cleared in `finally` after it.
A body that stalls, is cut off or is not valid JSON must resolve to the same
`{ ok: false, status: 0, data: null }` failure as a network error. Keep the
existing `console.error(error)` as the single log of that failure, and update
the comment above `fetchJson` ("A network failure or timeout resolves to a
failure with status 0") to include an unreadable body.

**Verify**: `pnpm test src/fetch` → all pass. If an existing assertion
expected a rejection for a malformed body, update it to expect the status 0
failure and note it in your report.

### Step 6: Give booking more time than a read

A booking whose answer arrives late is reported as a failure although the
Lightning Lane exists. In `src/api/ll/wdw.ts` (`book`, the request to
`${EXPERIENCES_PATH}/entitlements/book`) and `src/api/ll/dlr.ts` (`book`, the
request that makes the booking), pass `timeoutMs: BOOKING_TIMEOUT_MS`. Define
`const BOOKING_TIMEOUT_MS = 20_000;` once, in `src/api/ll.ts` beside the
other exported constants, with a comment saying why booking waits longer, and
import it in both files.

**Verify**: `grep -n "BOOKING_TIMEOUT_MS" src/api/ll.ts src/api/ll/wdw.ts src/api/ll/dlr.ts`
→ one definition, one use in each client.

### Step 7: Say so when the party may already be booked

In `server/jobs/outcome.ts`, `NoEligibleGuests` carries `guests`. When any
guest in `error.guests.ineligible` has
`ineligibleReason === 'EXPERIENCE_LIMIT_REACHED'`, the likeliest cause is a
booking whose answer was lost. Return the same failure code with this
message instead:

`'Your party can no longer book this Lightning Lane. Check your plans: it may already be booked.'`

Extract a small named function for the choice of message.

**Verify**: `pnpm typecheck` → exit 0.

### Step 8: Don't cache a failed resort load

In `server/disney/clients.ts`, remove the entry from `resorts` when
`loadResort` rejects, so the next job tries again:

```ts
resort = loadResort(resortId);
resorts.set(resortId, resort);
resort.catch(() => resorts.delete(resortId));
```

Adjust it to the file's style and update the comment above `resortFor`
("Loads each resort's data once") to mention that a failed load is retried.

**Verify**: `pnpm checkall` → all pass. `pnpm build` → exit 0.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Plan 012 adds tests for
`auto-book.ts` and must cover: a `SensorDataUnavailable` is retried, a 401 is
final, and an unbroken run of interruptions never ends the search.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -rn "ConnectionLost\|MAX_CONSECUTIVE_FAILURES\|isTransient" src server` returns nothing
- [ ] `grep -n "CONNECTION_LOST" server/jobs/job.ts` still returns one line
- [ ] `grep -n "AbortSignal.timeout" src/api/sensor-data.ts` returns one line
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- The excerpts above don't match the live code.
- `autoBook` has gained a caller other than `server/jobs/runner.ts`
  (`grep -rn "autoBook(" src server`). A browser caller would need its own
  give-up rule.
- Step 5 breaks more than two existing tests, which would mean callers depend
  on rejections.
- You find you need to change `server/jobs/job.ts`.

## Maintenance notes

- A search can now only end by booking, by a final error, by its window
  closing, by its login expiring or by being cancelled. A bug that throws on
  every check will therefore retry every 30 seconds until the window closes;
  the `'job check interrupted'` log line is how it is noticed.
- Reviewers should check that `isFinal` lists every error for which retrying
  is pointless and nothing else.
- Sharing one token source per job instead of one per process was considered
  and left out: with the retry in place a failed fetch costs one backoff.
