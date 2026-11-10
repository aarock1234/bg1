# Plan 002: The app never loses track of a search it handed to the server

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7be6d38..HEAD -- src/hooks/useServerJob.ts src/components/ll/screens/BookExperience.tsx src/components/ll/screens/BookExperience/AutoBook.tsx src/components/ll/screens/BookExperience/auto-book-messages.ts src/api/bg1-server.ts`
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

On the booking screen, "Start Auto Booking" hands a search to the server and
stores the job's id and secret token on the device. The token is the only way
to check on or stop that job. Today a single failed network request, common
on park Wi-Fi, makes a running search look like it isn't running; tapping
Start then throws the token away and starts a second search. The first keeps
running on the server with the guest's Disney login, can't be stopped, and
can still book. After this plan a stored job is always followed until the
server says it ended, and its token is only forgotten when the server
confirms there is nothing left to stop.

## Current state

- `src/hooks/useServerJob.ts`: creates, follows, stops and stores jobs, one
  per experience, under the storage key `bg1.server.jobs`.
- `src/components/ll/screens/BookExperience/AutoBook.tsx`: the panel.
- `src/components/ll/screens/BookExperience/auto-book-messages.ts`: wording.
- `src/components/ll/screens/BookExperience.tsx`: wires the hook to the panel.
- `src/api/bg1-server.ts`: the browser's client for the server's API.

The state the hook exposes (`src/hooks/useServerJob.ts:28-45`):

```ts
export type ServerJobState =
  | {
      kind: 'idle';
    }
  | {
      kind: 'starting';
    }
  | {
      // The server has the search. `job.status` says how it is going or how
      // it ended.
      kind: 'tracking';
      job: JobView;
    }
  | {
      // The server didn't take the search, or couldn't be reached.
      kind: 'rejected';
      error: unknown;
    };
```

**Defect A: polling only runs once a job has been seen.**
`src/hooks/useServerJob.ts:171-202`. When the first `getJob` after opening
the screen fails, `refresh` returns `true` but state stays `idle`, so
`isSearching` is false and the interval never starts:

```ts
      // A failed check says nothing about the search itself, which carries
      // on at the server. Try again at the next turn.
      console.warn('server job check failed', error);

      return true;
    }
  }, [experienceId]);

  // Picks up a search handed over earlier.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isSearching) {
      return;
    }

    const intervalId = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isSearching, refresh]);
```

**Defect B: Start forgets a job without stopping it.** In `AutoBook.tsx`,
`toggleSearch` calls `onDismiss()` before `onStart(range)`, and `dismiss`
(`useServerJob.ts:271-274`) deletes the stored token unconditionally:

```ts
const dismiss = useCallback(() => {
  storeJob(experienceId, undefined);
  setState(IDLE);
}, [experienceId]);
```

**Defect C: a failed Stop looks like a search that never started.**
`useServerJob.ts:256-264` sets `rejected`, which stops the polling and flips
the button to "Start Auto Booking"; the panel titles every `rejected` state
"Auto Booking Didn't Start":

```ts
    } catch (error) {
      if (!isJobGone(error)) {
        console.error('server job could not be stopped', error);
        setState({
          kind: 'rejected',
          error,
        });
        return;
      }
    }
```

**Defect D: a late answer can undo a Stop.** A `getJob` sent just before
Stop can resolve after it and set `tracking`/`searching` again
(`useServerJob.ts:151-156`).

**Defect E: a booking found while stopping is announced twice.**
`useServerJob.ts:248-255` returns before forgetting the job, so the next time
the screen opens `refresh` finds it booked and calls `onBooked` again.

**Defect F: the offer on screen is stale after a search.** The server
requests offers of its own, which invalidates the one on screen. In
`BookExperience.tsx` the panel is wired with `onStop: serverJob.stop`, and
nothing clears the offer when the search stops or ends, so "Book Lightning
Lane" then fails with "Offer expired". The screen loads a fresh offer
whenever `offer` is `undefined` (`setOffer(undefined)`), through this effect:

```ts
useEffect(() => {
  if (offer === undefined) {
    refreshOffer(true);
  }
}, [offer, refreshOffer]);
```

**Defect G: creating a job can time out after the server stored it.**
`src/api/bg1-server.ts:87-94` uses `fetchJson`'s default of 8 seconds, while
the server loads resort data before answering. A timeout leaves a job
running whose token the device never received:

```ts
export function createJob(
  jobRequest: CreateJobRequest
): Promise<CreateJobResponse> {
  return request<CreateJobResponse>({
    path: 'jobs',
    data: jobRequest,
  });
}
```

`PROBE_TIMEOUT_MS = 60_000` at the top of that file is the pattern for a
named, commented timeout.

**Defect H: most rejections read as "couldn't be reached".**
`auto-book-messages.ts:8-12` maps three codes:

```ts
const REJECTION_MESSAGES: Record<string, string> = {
  login_expired: 'Your Disney login has expired. Sign in again to start.',
  window_over: 'That time range is already over.',
  date_not_bookable: "Auto booking isn't available for that date.",
};
```

The server's codes (`server/jobs/create.ts`, `RejectionCode`, and
`server/jobs/routes.ts`): `login_expired`, `invalid_time_range`,
`window_over`, `date_not_bookable`, `unknown_experience`, `too_many_guests`,
plus `invalid_request` (400) and `request_too_large` (413).
`ServerRequestFailed` has `status` (0 when the server could not be reached)
and an optional `code`.

**Defect I: a time picker reopens when dismissed.** `AutoBook.tsx`'s
`TimeSelect` wraps `Select` (a button plus its overlay menu) in a `<label>`,
so a tap that closes the menu is forwarded to the button and opens it again:

```tsx
    <label className="field">
      <span className="field-label">{label}</span>
      <Select
```

## Target design

Keep it a small state machine; do not add a library. The rule that fixes A–E:

> While a job is stored for this experience, the hook is **following** it.
> Following only ends when the server reports the job ended, or reports it
> gone (404 or 401). Nothing else forgets a job.

Shape to aim for:

- Add a state member for a stored job whose status is not known yet:

  ```ts
  | {
      // A search was handed over earlier and the server hasn't been reached
      // yet to ask how it is going.
      kind: 'resuming';
    }
  ```

  Initialise state to `resuming` when `storedJobs()[experienceId]` exists and
  to `idle` otherwise (use a lazy `useState` initialiser).

- Poll while the job is being followed: state is `resuming`, or `tracking`
  with status `searching`. Derive that as one boolean named `isFollowing`.

- `refresh` ignores an answer for a job that is no longer the stored one:
  read the stored job before the request, and after it compare
  `storedJobs()[experienceId]?.id` with the id that was asked about; return
  without touching state when they differ (defect D).

- `stop` on a failure that isn't "gone" keeps the job and its state, and
  reports the failure separately. Add `stopError: unknown` to what the hook
  returns (`undefined` when there is none), cleared when a stop succeeds or a
  new search starts. Remove the `setState({ kind: 'rejected' })` from `stop`
  (defect C).

- `stop` on finding the job booked forgets the stored job before calling
  `onBooked` (defect E).

- Remove `dismiss` from the hook's public result. `start` returns without
  doing anything when a job is being followed; otherwise it clears the
  previous outcome itself (defect B).

## Scope

**In scope**:

- `src/hooks/useServerJob.ts`
- `src/components/ll/screens/BookExperience.tsx` (only the `AutoBookPanel`
  type, `autoBookPanel`, and the `isSearching` computation in `BookingPanel`)
- `src/components/ll/screens/BookExperience/AutoBook.tsx`
- `src/components/ll/screens/BookExperience/auto-book-messages.ts`
- `src/api/bg1-server.ts` (only `createJob`'s timeout)
- `src/preview/**` only if it stops compiling because the panel's props
  changed

**Out of scope**:

- `server/**`: the API does not change.
- `src/push.ts`: `Notification.requestPermission()` must stay the first thing
  awaited after the tap, or iOS refuses it. Do not add an `await` before
  `requestPushSubscription()` in `start`.
- Styling. Reuse the classes already in `AutoBook.tsx`; `docs/design.md`
  describes them.

## Steps

### Step 1: Rework the hook

Apply the target design to `src/hooks/useServerJob.ts`. Keep `storedJobs`,
`storeJob`, `isStoredJob` and `isJobGone` as they are. Update the comments on
`ServerJobState`, `ServerJob` and `refresh` to describe the rule above.

**Verify**: `pnpm typecheck` → errors only in `BookExperience.tsx`,
`AutoBook.tsx` or `src/preview`, which the next steps fix.

### Step 2: Update the panel

In `AutoBook.tsx`:

1. Replace `onDismiss` in `AutoBookProps` with `stopError: unknown`.
2. Treat `resuming` like `starting`: selects disabled, the button disabled.
   Show a short status line in the same markup as `Searching`, with the text
   `Checking on your search…`.
3. `toggleSearch` no longer calls a dismiss; it calls `onStop()` when the
   state is `tracking` with status `searching`, otherwise `onStart(range)`.
4. When `stopError` is set, show an `Alert` titled `Couldn't Stop Auto Booking`
   with `rejectionMessage(stopError)` and keep the button as "Stop Auto
   Booking".
5. In `TimeSelect`, change the wrapping `<label className="field">` to a
   `<div className="field">` (defect I). `Select` already gets a `title`, so
   its accessible name is unchanged.

**Verify**: `pnpm test src/components/ll/screens/BookExperience` → all pass.

### Step 3: Refresh the offer when a search stops or ends

In `BookExperience.tsx`:

1. Update `AutoBookPanel` and `autoBookPanel` for the new props.
2. Add one effect that clears the offer when a followed search leaves
   `searching`, so the existing effect loads a fresh one. Track the previous
   value with a ref, and add a comment saying why (the server requested
   offers of its own, so the one on screen is stale). It must not fire on the
   first render or when no search was running.
3. `BookingPanel` hides the Book button while a search is running; also hide
   it while the state is `resuming`. Extract the condition into a small named
   function next to `BookingPanel`.

**Verify**: `pnpm test src/components/ll/screens/BookExperience` → all pass.

### Step 4: Give job creation time

In `src/api/bg1-server.ts` add `const CREATE_JOB_TIMEOUT_MS = 30_000;` beside
`PROBE_TIMEOUT_MS`, with a comment saying the server loads resort data before
it answers and that a timeout here would leave a search running that the
device can't stop. Pass it as `timeoutMs` in `createJob`.

**Verify**: `grep -n "CREATE_JOB_TIMEOUT_MS" src/api/bg1-server.ts` → two lines.

### Step 5: Say what actually went wrong

In `auto-book-messages.ts`:

1. Add to `REJECTION_MESSAGES`:
   - `invalid_time_range`: `'The latest time has to be after the earliest.'`
   - `unknown_experience`: `"BG1's server doesn't know this experience yet. Try again later."`
   - `too_many_guests`: `'That party is too large to book at once.'`
2. In `rejectionMessage`, distinguish three cases: a known code (its
   message); `error.status === 0` (the existing "couldn't be reached"
   message); anything else:
   `"BG1's server couldn't take that. Try again in a moment."`

**Verify**: `pnpm checkall` → all pass. `pnpm build` → exit 0.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Plan 012 adds a test file for
`useServerJob` and must cover defects A to E as named cases.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -rn "onDismiss\|dismiss" src/hooks/useServerJob.ts src/components/ll/screens/BookExperience.tsx src/components/ll/screens/BookExperience/AutoBook.tsx` returns nothing
- [ ] `grep -n "<label" src/components/ll/screens/BookExperience/AutoBook.tsx` returns nothing
- [ ] `grep -n "'resuming'" src/hooks/useServerJob.ts` returns at least two lines
- [ ] In `useServerJob.ts`, `storeJob(experienceId, undefined)` appears only where the server reported the job ended or gone (read the file and confirm)
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- The excerpts above don't match the live code.
- Fixing a defect seems to need an `await` before `requestPushSubscription()`
  in `start`.
- An existing `BookExperience` test fails for a reason other than a renamed
  prop.
- The server API appears to need a change.

## Maintenance notes

- A job created by a request that still times out after 30 seconds is the one
  remaining way to lose a token. Fixing it properly means the client choosing
  the job's id or an idempotency key; that is a server change, deferred.
- Jobs are stored per experience, so a guest must open a ride to see its
  search. A list of all running searches is the natural follow-up.
- Reviewers: check every `storeJob(experienceId, undefined)` against the rule
  in "Target design".
