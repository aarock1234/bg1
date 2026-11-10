# Plan 012: The code that books on its own is covered by tests

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **This is the one plan that adds tests.** The owner's standing rule is no
> new tests unless he asks; he asked for this plan to be written. Do not add
> a test framework or a test dependency: the existing jest setup is enough.
>
> **Drift check (run first)**: plans 001, 002, 004, 005, 006, 007 and 008
> change the code under test. Confirm in `plans/README.md` which are DONE and
> read the live code; write tests for the behaviour that exists.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW (additive)
- **Depends on**: plans 001, 002, 004, 005 (the behaviour they define is what gets tested); 006–008 for their units
- **Category**: tests
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

The server holds guests' Disney logins and books Lightning Lanes while nobody
is watching. None of it is tested: every one of the 61 test suites is under
`src/`, and the search loop, the hook that follows a search, and all of
`server/` have none. Several of the bugs plans 001–005 fix would have been
caught by a dozen small tests. This plan adds them where the logic is pure
and the stakes are highest, and deliberately stops short of testing against
a database.

## Current state

- `jest.config.js` maps `@/` to `src/` and uses the `jsdom` environment.
  `pnpm test` runs `TZ=UTC jest`.
- Tests sit beside the file they cover, named `<file>.test.ts(x)`.
- Patterns to copy: `src/api/ll.test.ts` (a client with faked requests),
  `src/hooks/useDataLoader.test.tsx` (a hook with fake timers),
  `src/components/ll/screens/BookExperience.test.tsx` (mocked modules,
  fixtures from `src/__fixtures__`).
- Server files can run under jest with a `/** @jest-environment node */`
  docblock at the top of the test file.
- `server/disney/login-crypto.ts` and `server/push/notify.ts` import `env`
  from `server/config/env.ts`, which throws at import when required
  variables are missing. Anything that imports them needs the variables set
  before import, or must not be imported.

## Scope

**In scope**: new `*.test.ts(x)` files beside the units listed below;
`jest.config.js` only if server tests need a path mapping or a `roots`
change to be found.

**Out of scope**:

- Production code. If a unit can't be tested without changing it, write down
  why and skip it; do not refactor here.
- `server/jobs/repository.ts`, `runner.ts`, `worker.ts`, `routes.ts`: they
  need a database or heavy mocking that would test the mocks.
- New dependencies of any kind.

## Steps

Commit after each step. Name every test for the behaviour it protects.

### Step 1: The search loop, `src/api/ll/auto-book.test.ts`

Use a fake `ll` object (plain functions returning promises), jest fake
timers and an `AbortController`. Cases:

- books when the offered time is inside the range, inclusive at both ends
- an offer outside the range is a miss and is not booked
- Disney answering 410 is `unavailable`, and the search continues
- a failed token fetch (`SensorDataUnavailable`) is retried, not fatal
- a 5xx, a 403, a 429 and a network failure are each retried
- a 401 ends the search; so do `ReauthNeeded`, `ModifyNotAllowed` and
  `RateLimitExceeded`
- twenty interruptions in a row do not end the search, and the wait between
  them never exceeds 30 seconds
- aborting during the wait rejects with the signal's reason
- an offer that leaves out a requested guest is not booked (plan 004)
- a party that is all "too early" keeps searching; a party that has all
  reached the experience limit ends it (plan 004)
- with time selection: an out-of-range offer is moved to the earliest
  in-range time and booked; with no in-range time nothing is changed; a moved
  offer that comes back out of range is not booked; a client without time
  selection never asks for times (plan 005)

**Verify**: `pnpm test auto-book` → all pass.

### Step 2: Following a search, `src/hooks/useServerJob.test.tsx`

Mock `@/api/bg1-server` and `@/push`. Cases, named after the defects in plan
002:

- a stored job whose first check fails is still followed, and found on a
  later check
- starting while a job is followed does not create a second job and does not
  forget the first
- a failed stop keeps the job and reports the failure
- a late answer for a stopped job does not bring it back
- a job found booked calls `onBooked` once, including across a remount
- an ended job is forgotten after being shown once
- a job the server no longer knows (404) is forgotten

**Verify**: `pnpm test useServerJob` → all pass.

### Step 3: Pure server units

One test file each, with the node environment docblock:

- `server/jobs/window.ts`: `isWindowOver` and `isRangeBackward` for both
  resorts, including a range that crosses midnight, the 4 AM park-day
  boundary, and a moment that is already tomorrow in UTC but still tonight
  in the park.
- `server/jobs/outcome.ts`: each final error maps to its code; the wording
  for a party at its experience limit (plan 001).
- `server/disney/pace.ts`: the limit at 1000, 500 and 250 ms.
- `server/disney/proxies.ts`: `parseProxies` for lines, commas, blank lines
  and a malformed entry.
- `server/jobs/token.ts`: a token matches its own hash and not another's.
- `server/jobs/public-view.ts`: the view never contains the token hash, the
  login or the push subscription.
- The error describer from plan 007: a query failure never yields its
  parameters or its SQL.
- The relay's address builder from plan 006, if it is exported: a plain path,
  a path with a query, and an encoded host segment that must be refused.
- `server/jobs/job.ts`: `jobGuestSchema` accepts a guest with `null`
  `orderDetails` and keeps unknown fields (plan 008).

Skip any unit whose plan is not DONE, and say so.

**Verify**: `pnpm test server` → all pass.

### Step 4: Messages, `auto-book-messages.test.ts`

Each attempt kind and each rejection code has its wording; an unreachable
server and an unknown code read differently.

**Verify**: `pnpm checkall` → all pass, with more suites and tests than
before. Record the counts before and after.

## Test plan

This plan is the test plan. Keep each test small, with no shared mutable
state between tests, no real timers and no network.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm test auto-book` and `pnpm test useServerJob` each run at least ten and seven tests
- [ ] `pnpm test server` runs tests from at least five files
- [ ] `git diff --stat <start>..HEAD -- src server | grep -v "\.test\."` shows no production file changed (apart from `jest.config.js` if needed)
- [ ] `package.json` dependencies are unchanged

## STOP conditions

- A test you write for behaviour a DONE plan describes fails against the live
  code. That is a bug in the earlier work: report it with the failing test,
  do not change the test to pass.
- Server tests can't be discovered or can't resolve `@/` without a larger
  change to the jest setup than a mapping.
- Importing a unit pulls in `server/config/env.ts` and throws.

## Maintenance notes

- The job runner, repository and worker remain untested. Covering them needs
  a real Postgres in the test run; that is a decision for the owner.
- When a bug is found in the search loop or the hook, add its case to these
  files first.
