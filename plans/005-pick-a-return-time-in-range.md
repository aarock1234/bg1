# Plan 005: At Walt Disney World, a search picks a return time inside the range

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**: this plan builds on plans 001 and 004, which
> change `src/api/ll/auto-book.ts`. Confirm both are DONE in
> `plans/README.md`, then read the live file. Also run
> `git diff --stat 7be6d38..HEAD -- src/api/ll/wdw.ts src/api/ll.ts server/disney/pace.ts`
> and compare the excerpts below with the live code.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (it adds requests to Disney on every check that misses)
- **Depends on**: plans/001-keep-searching-through-trouble.md, plans/004-book-the-whole-party-or-wait.md
- **Category**: bug
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

Walt Disney World lets a guest choose a return time later than the one first
offered. The search ignores that: it looks only at the first time Disney
offers. A guest who asks for 2–4 PM at 10 AM, when the next available time is
10:30 AM, gets nothing until the next available time drifts into the
afternoon, even though 2 PM slots can be had right now. After this plan the
search asks Disney which times are available and moves the offer to the
first one inside the range.

## Current state

- `src/api/ll/auto-book.ts`: the search loop.
- `src/api/ll.ts`: the `LLClient` base class and types.
- `src/api/ll/wdw.ts`: the Walt Disney World client.
- `src/api/ll/dlr.ts`: the Disneyland client, where times can't be chosen.
- `server/disney/pace.ts`: derives the client's request limit from the pace.
- `server/jobs/runner.ts`: builds the client and calls `autoBook`.

What a client says it supports (`src/api/ll.ts:206-217` and `:360-365`): the
base class has `timeSelect: false`; `wdw.ts:175-180` sets `timeSelect: true`.

The two calls this plan uses, both on `LLClient` (`src/api/ll.ts:422-427`):

```ts
  abstract times(offer: Offer): Promise<HourlyTimes>;

  abstract changeOfferTime<B extends Offer['booking']>(
    offer: Offer<B>,
    time: ParkTime
  ): Promise<Offer<B>>;
```

`HourlyTimes` is `ParkTime[][]`: available start times grouped by hour.
`changeOfferTime` returns the offer moved to the requested time; the time
Disney actually gives is in the returned offer's `start`, and may differ from
what was asked.

The search's client type (`auto-book.ts:62`):

```ts
ll: Pick<LLClient, 'offer' | 'book' | 'cancelBooking'>;
```

The range check, inclusive at both ends (`auto-book.ts:99-101`):

```ts
function isWithinRange(time: ParkTime, range: ReturnTimeRange): boolean {
  return time >= range.earliest && time <= range.latest;
}
```

`ParkTime` values compare with `>=`/`<=` as shown.

The request budget (`server/disney/pace.ts`, whole file):

```ts
const MS_PER_SECOND = 1000;

// The most requests one auto-book check can make: the offer, a change of its
// time, the booking, and the cancellation for guests who weren't chosen.
const MAX_REQUESTS_PER_CHECK = 4;

// Returns the lowest per-second request limit that auto booking at the given
// pace can never exceed. A client's rate limit refuses every later request
// once it is exceeded, so the limit has to cover the worst case: every check
// that can start within one second making all of its requests, on top of a
// check that started just before.
export function minimumRequestsPerSecond(pollIntervalMs: number): number {
  const checksStartedPerSecond = Math.ceil(MS_PER_SECOND / pollIntervalMs);

  return MAX_REQUESTS_PER_CHECK * (checksStartedPerSecond + 1);
}
```

Exceeding the limit throws `RateLimitExceeded`, which ends the search for
good, so the budget must be raised in the same commit that adds requests.

Each protected request also uses up a bot-protection token; a token lasts
five requests. More requests per check means more token fetches from a
third-party service. That is acceptable only when the extra requests happen
on a miss that could become a booking.

## Target behaviour

When an offer's time is outside the range and the client can select times:

1. Ask `ll.times(offer)`.
2. Take the earliest time, across all hours, that is inside the range.
3. If there is none, the check is an `outside-range` miss, as today.
4. Otherwise `ll.changeOfferTime(offer, thatTime)`.
5. Re-check the moved offer's `start.time` against the range. Disney may give
   a different time than asked. Book only if it is inside; otherwise it is an
   `outside-range` miss reporting the time Disney gave.

At Disneyland (`timeSelect: false`) nothing changes.

## Scope

**In scope**:

- `src/api/ll/auto-book.ts`
- `server/disney/pace.ts`
- `server/jobs/runner.ts` only if the `ll` it passes no longer satisfies the
  widened type (it passes a full `LLClient`, so it should)

**Out of scope**:

- `src/api/ll/wdw.ts` and `src/api/ll/dlr.ts`: use `times` and
  `changeOfferTime` as they are.
- `targetedTime` in `wdw.ts:231`. The server sends `08:00:00` because it has
  no live "next available time". Whether a different value yields better
  first offers is unknown and must not be guessed at here.
- The browser's booking screen.

## Steps

### Step 1: Widen the client the search needs

In `auto-book.ts` change the `ll` type to also pick `'rules'`, `'times'` and
`'changeOfferTime'`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Move an out-of-range offer into the range

Add two small functions to `auto-book.ts`:

- One that returns the earliest time in an `HourlyTimes` that is within a
  range, or `undefined`. Flatten, filter with `isWithinRange`, and pick the
  minimum explicitly; do not rely on the order Disney returns.
- One that takes the request and an out-of-range offer and returns either the
  moved offer or `undefined` when no time in range is available. It makes the
  two calls from "Target behaviour".

In `attemptBooking`, after the whole-party check from plan 004: when the
offer is outside the range and `ll.rules.timeSelect` is true, try to move it.
Then apply the range check to whichever offer you now hold, call
`signal.throwIfAborted()` before booking as today, and book that offer.

Keep `attemptBooking` readable: it should read as offer → whole party →
in range (moving it if possible) → book. Extract rather than nest.

Errors from `times` and `changeOfferTime` need no special handling: plan 001
made every non-final error an `interrupted` miss, and a 410 is `unavailable`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Raise the request budget

In `server/disney/pace.ts` set `MAX_REQUESTS_PER_CHECK` to `5` and rewrite
its comment to list the five: the offer, the available times, the change of
time, the booking, and the cancellation for guests who weren't chosen.

**Verify**: `pnpm checkall` → all pass. `pnpm build` → exit 0.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Plan 012 must cover, with a fake
client: an out-of-range offer with an in-range time available is moved and
booked; one with no in-range time is a miss and makes no change request; a
moved offer that comes back outside the range is not booked; a client with
`timeSelect: false` never calls `times`.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "changeOfferTime\|ll.times\|timeSelect" src/api/ll/auto-book.ts` shows each used
- [ ] `grep -n "MAX_REQUESTS_PER_CHECK = 5" server/disney/pace.ts` returns one line
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- Plans 001 or 004 are not DONE.
- `times` or `changeOfferTime` in `wdw.ts` no longer match the signatures
  above.
- `README.md`'s table says `DISNEY_REQUESTS_PER_SECOND` is `8` at the default
  pace; after step 3 it is `10`. Do not edit the README here (plan 010 owns
  it), but say so in your report.

## Maintenance notes

- **Unverified against Disney.** Nobody has watched a server search move an
  offer at Walt Disney World. After this ships, the first real search with a
  later range should be watched in the Railway logs. If Disney throttles the
  extra `times` request on every miss, the fallback is to ask for times less
  often than every check (for example every fifth miss), which is a small
  change inside the function added in step 2.
- A production deploy that sets `DISNEY_REQUESTS_PER_SECOND` below 10 will
  refuse to start after this change; the variable is not set today.
