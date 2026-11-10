# Plan 008: Jobs are run once, forgotten when old, and leave nothing open

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7be6d38..HEAD -- server/jobs/worker.ts server/jobs/repository.ts server/jobs/runner.ts server/jobs/job.ts server/jobs/create.ts server/db/schema.ts server/disney/proxies.ts server/probe/probe.ts`
> Plans 001, 004 and 007 touch `runner.ts` and `job.ts`; that is expected. For
> every other difference, compare the excerpts below with the live code.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (one step changes the database schema)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

Five small faults in how the server keeps its jobs. None bites often, but
each is the kind that shows up on a bad day: a job can be run twice by the
same instance after a stall; finished jobs keep guests' names forever; a
column and index serve a feature that was removed; a guest object Disney
sends with a `null` field is rejected; and every proxied job leaves a
connection pool open.

## Current state

### A. An instance can claim a job it is already running

`server/jobs/worker.ts:106-126`:

```ts
  async function claimAvailableJobs(): Promise<void> {
    const capacity = MAX_RUNNING_JOBS - runningJobs.size;

    if (capacity <= 0) {
      return;
    }

    const claimed = await claimJobs({
      owner,
      leaseMs: LEASE_MS,
      limit: capacity,
    });

    for (const job of claimed.jobs) {
      const runningJob = startJob(job, runnerOptions);

      runningJobs.set(job.id, runningJob);

      // `done` never rejects, so this needs no failure handling of its own.
      void runningJob.done.then(() => runningJobs.delete(job.id));
    }
```

`claimJobs` (`server/jobs/repository.ts:120-164`) takes any searching job
whose lease has expired. A lease lasts 30 seconds and is renewed by a
heartbeat every 5. In `server/jobs/runner.ts` the supervisor awaits
`this.checkpoint(session)` (which may refresh the login: two requests to
Disney's login service) **before** `this.heartbeat()`:

```ts
      try {
        await this.checkpoint(session);
        await this.heartbeat();
      } catch (error) {
```

A slow refresh or a database stall can let the lease lapse while the run is
still alive. The same instance then claims the job again and runs it twice.
When the first run ends, its `done.then` deletes the map entry that now
belongs to the second run, so cancel and shutdown no longer reach it.

### B. Finished jobs are kept forever

`server/jobs/repository.ts:75-84`: ending a job clears the login and the push
subscription and sets `finishedAt`. Nothing ever deletes a row; the `guests`
and `result` columns keep names and Disney ids. The app forgets a job as soon
as it has shown its ending once.

### C. A column and an index nothing reads

`server/db/schema.ts:28` and `:67`:

```ts
    accountHash: text('account_hash').notNull(),
```

```ts
    index('jobs_account_hash_status_index').on(table.accountHash, table.status),
```

`server/jobs/create.ts:175` writes `accountHash: sha256(login.swid)`. It
existed for a per-account job cap that was removed. It is also listed in
`server/jobs/job.ts` (`accountHash: z.string()`) and in the `NewJob` type in
`server/jobs/repository.ts`.

Migrations: `pnpm db:generate` writes a migration into
`server/db/migrations/` from `server/db/schema.ts` without needing a
database. The server applies pending migrations when it starts.

### D. The guest schema is stricter than what the app sends

`server/jobs/job.ts:53-68`:

```ts
export const jobGuestSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),

  // Walt Disney World's booking request needs this for each guest.
  orderDetails: z
    .object({
      externalIdentifier: z.object({
        id: z.string(),
        idType: z.string(),
      }),
      orderId: z.string(),
      orderItemId: z.string(),
    })
    .optional(),
});
```

`.optional()` rejects `null`, and the inner `z.object` drops fields it
doesn't list, although the comment above says the rest of the guest "travel
along untouched, because Disney's booking requests are built from the whole
guest".

### E. A proxied client's connections are never closed

`server/disney/proxies.ts:31-51`: `proxiedFetch` creates a `ProxyAgent` and
returns only the fetch function, so nothing can close the agent. One is
created per job (`server/jobs/runner.ts`, in `JobRun`'s constructor) and per
probe (`server/probe/probe.ts`).

### F. The probe changes the whole process's time zone

`server/probe/probe.ts:188`:

```ts
DateTime.setTimeZone(RESORT_TIME_ZONES[request.resortId]);
```

and `:155` then uses `parkDate()`, which reads that global. Jobs deliberately
avoid the global: `server/jobs/window.ts` uses `dateTimeInZone` from
`@/datetime` and its own `resortNow(resortId)`.

## Scope

**In scope**:

- `server/jobs/worker.ts`, `server/jobs/repository.ts`,
  `server/jobs/runner.ts`, `server/jobs/job.ts`, `server/jobs/create.ts`
- `server/db/schema.ts` and the new files `pnpm db:generate` writes under
  `server/db/migrations/`
- `server/disney/proxies.ts`, `server/probe/probe.ts`

**Out of scope**:

- `server/db/migrations/0000_create_jobs.sql`: never edit an applied
  migration.
- `src/datetime.ts` and the Lightning Lane clients.
- Sharing one login between several jobs for the same account.

## Steps

Commit after each step; they are independent.

### Step 1: Never run a job twice in one instance (A)

1. In `claimAvailableJobs`, skip a claimed job that is already in
   `runningJobs`: log `'job claimed while already running'` at `warn` with
   the `jobId` and `continue`. The run that is still alive has had its lease
   renewed by the claim, since both use the same owner.
2. Delete a map entry only if it still belongs to the run that finished:

   ```ts
   void runningJob.done.then(() => {
     if (runningJobs.get(job.id) === runningJob) {
       runningJobs.delete(job.id);
     }
   });
   ```

3. In `runner.ts`'s supervisor, send the heartbeat before the checkpoint, so
   a slow login refresh can't delay it. Give each its own `try`/`catch` with
   its own log message if that reads more clearly than sharing one.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Forget finished jobs after a week (B)

1. In `repository.ts` add `deleteFinishedJobs(olderThanMs: number): Promise<number>`,
   which deletes rows whose `finishedAt` is older than that and returns how
   many. Use the database clock, in the style of `leaseExpiry`. Give the
   function a comment saying what a finished job still holds and why it is
   removed.
2. In `worker.ts` add `FINISHED_JOB_RETENTION_MS` (seven days) and
   `PURGE_INTERVAL_MS` (one hour), each with a comment. Call the delete from
   the claim loop at most once per interval, tracked by a timestamp in the
   worker's closure; it must run once soon after startup. Log
   `'finished jobs purged'` with the count only when the count is above zero.
   A failure is logged by the loop's existing `catch` and must not stop
   claiming; keep the purge after the claim so a failing purge never delays
   one.

**Verify**: `pnpm typecheck` → exit 0. `pnpm lint` → exit 0.

### Step 3: Drop the unused column and index (C)

1. Remove `accountHash` and `jobs_account_hash_status_index` from
   `server/db/schema.ts`, and fix the comment above `tokenHash`, which
   mentions both hashes.
2. Remove `accountHash` from `server/jobs/job.ts`, from `NewJob` in
   `server/jobs/repository.ts`, and from `server/jobs/create.ts`. Remove
   `sha256` from `create.ts`'s imports if nothing else there uses it, and
   from `server/jobs/token.ts`'s exports only if nothing imports it
   (`grep -rn "sha256" server`).
3. Run `pnpm db:generate`. It must write one new migration that drops the
   index and the column, and update the files under
   `server/db/migrations/meta/`. Read the generated SQL and confirm it does
   only that.

**Verify**: `grep -rn "accountHash\|account_hash" server --include=*.ts` → no
matches. `pnpm checkall` → all pass.

### Step 4: Accept the guests the app really sends (D)

In `jobGuestSchema`, make `orderDetails` `.nullish()` and make its object and
the nested `externalIdentifier` object `z.looseObject`, so unknown fields
pass through as the comment promises. Check every reader of
`guest.orderDetails` on the server for a `null` it must now handle
(`grep -rn "orderDetails" server src/api`). The shared code decides with
`hasOrderDetails`; read it and confirm `null` is treated as absent. If it is
not, STOP.

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: Close a proxied client's connections (E)

Change `proxiedFetch` to return a named type with the fetch and a way to
close it:

```ts
export type ProxiedFetch = {
  fetch: typeof fetch;

  // Closes the connections kept open to the proxy.
  close(): Promise<void>;
};
```

In `runner.ts`, keep the `ProxiedFetch` on the `JobRun` and close it in
`run()` after `conclude`, in a `finally`, catching and logging a failure to
close with the run's logger. In `probe.ts`, close it in a `finally` around
the checks that use it.

**Verify**: `pnpm typecheck` → exit 0.
`grep -rn "proxiedFetch(" server` → every call site keeps the result and
closes it.

### Step 6: Stop the probe changing the process's time zone (F)

Remove `DateTime.setTimeZone(...)` from `probe.ts`. Where the probe calls
`parkDate()`, compute the resort's date explicitly, the way
`server/jobs/window.ts` and `server/jobs/create.ts` do (read both; reuse
`resortNow` from `window.ts` rather than writing the zone lookup again).
Remove imports that become unused.

**Verify**: `grep -rn "setTimeZone" server` → no matches.
`pnpm checkall` → all pass. `pnpm build` → exit 0.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Plan 012 lists `window.ts` and the
guest schema as units worth covering.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -rn "accountHash\|account_hash" server --include=*.ts` returns nothing
- [ ] `ls server/db/migrations/*.sql` lists exactly two files
- [ ] `grep -rn "setTimeZone" server` returns nothing
- [ ] `grep -n "deleteFinishedJobs" server/jobs/repository.ts server/jobs/worker.ts` returns a line in each
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- The excerpts above don't match the live code.
- `pnpm db:generate` writes anything other than dropping one index and one
  column, or asks an interactive question about renaming.
- `hasOrderDetails` (or whatever reads `orderDetails`) treats `null` as
  present.
- The probe needs the global time zone for something besides `parkDate()`.

## Maintenance notes

- **Deploy note for step 3.** The new version drops the column when it
  starts, while the old version is still serving for a few seconds. A search
  created in that moment through the old version fails with a server error
  and the guest has to tap Start again. Deploy when nobody is starting a
  search.
- Seven days of finished jobs is for debugging; shorten it freely. The app
  never asks about a job after seeing it end.
- Step 1 leaves one known gap: two different instances can still both run a
  job if one stalls past its lease. The loser detects it at its next
  heartbeat and stops. That window is inherent to leases.
