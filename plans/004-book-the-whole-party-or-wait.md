# Plan 004: A search books the whole party or keeps waiting

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**: this plan builds on plan 001, which changes
> `src/api/ll/auto-book.ts`. Confirm plan 001 is DONE in `plans/README.md`,
> then read the live file; the excerpts below are from commit `7be6d38` and
> the `catch` block will already look different.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-keep-searching-through-trouble.md
- **Category**: bug
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

A guest starts a search for their whole party. If Disney then offers a time
that only some of them can take (one person booked something else in the
meantime), the search books the rest without saying so, and the family finds
out at the ride. The opposite fault also exists: when everyone is only
temporarily unable to book, such as too early in the day, the search fails
at once with "nobody can book" instead of waiting. After this plan a search
books only when every requested guest is covered, and gives up on eligibility
only when waiting cannot help.

## Current state

`src/api/ll/auto-book.ts` is the search loop; its only caller is
`server/jobs/runner.ts`.

At commit `7be6d38`, `attemptBooking` (`auto-book.ts:179-201`) books whatever
the offer covers:

```ts
  try {
    const offer = await ll.offer(experience, guests, offerOptions);
    const offeredTime = offer.start.time;

    if (!isWithinRange(offeredTime, range)) {
      return {
        kind: 'outside-range',
        offeredTime,
      };
    }

    // The search may have been stopped while the offer was loading.
    signal.throwIfAborted();

    return {
      kind: 'booked',
      booking: await bookForGuests(ll, offer, guests),
    };
```

`bookForGuests` (`src/api/ll/booking.ts`) calls `ll.book(offer, guests)`, and
both clients book `offer.guests.eligible`, which can be a subset of `guests`.

"Nobody can book" is decided by (`auto-book.ts:133-135`, used at `:207-209`):

```ts
function hasNoEligibleGuests(guests: Guests): boolean {
  return guests.eligible.length === 0 && guests.ineligible.length > 0;
}
```

A guest (`src/api/ll.ts:126-134`) has an optional
`ineligibleReason?: IneligibleReason` and `eligibleAfter?: ParkTime`. The
reasons (`src/api/ll.ts:106-114`) include `'EXPERIENCE_LIMIT_REACHED'`,
`'TOO_EARLY'`, `'TOO_EARLY_FOR_PARK_HOPPING'` and
`'TOO_EARLY_FOR_NEXT_PARK'`. A guest with `eligibleAfter` set, or with a
reason starting `TOO_EARLY`, becomes eligible later.

The `Miss` type lists why a check didn't book: `unavailable`,
`outside-range`, `interrupted`. The server stores the latest one in the
`last_attempt` column, validated by `lastAttemptSchema` in
`server/jobs/job.ts`:

```ts
export const lastAttemptSchema = z.object({
  kind: z.enum(['unavailable', 'outside-range', 'interrupted']),
```

The app words each kind in
`src/components/ll/screens/BookExperience/auto-book-messages.ts`
(`attemptMessage`), which has an exhaustive `switch` with a `never` check.

## Scope

**In scope**:

- `src/api/ll/auto-book.ts`
- `server/jobs/job.ts` (only the `kind` enum of `lastAttemptSchema`)
- `src/components/ll/screens/BookExperience/auto-book-messages.ts`

**Out of scope**:

- `src/api/ll/booking.ts`, `src/api/ll/wdw.ts`, `src/api/ll/dlr.ts`.
- `server/db/**`: `last_attempt` is jsonb, so no migration is needed.

## Steps

### Step 1: Add a miss for a party that isn't whole

In `auto-book.ts` add a member to `Miss`:

```ts
| {
    // Disney's offer left out some of the guests the search is for.
    kind: 'party-incomplete';
  }
```

Add a small function that tells whether an offer covers every requested
guest, comparing ids:

```ts
function coversEveryGuest(offer: Offer, guests: Guest[]): boolean {
  const offeredIds = new Set(offer.guests.eligible.map(guest => guest.id));

  return guests.every(guest => offeredIds.has(guest.id));
}
```

(`Offer` needs adding to the type import from `'../ll'`.) In
`attemptBooking`, check it right after the offer arrives and before the range
check, returning the new miss.

**Verify**: `pnpm typecheck` → errors only in `server/jobs/runner.ts`,
`server/jobs/job.ts` or `auto-book-messages.ts`, which the next steps fix.

### Step 2: Only give up when waiting can't help

Replace `hasNoEligibleGuests` with a predicate that is true only when nobody
is eligible **and** no ineligible guest can become eligible by waiting. Write
the "can become eligible" test as its own small named function:
`eligibleAfter` is set, or `ineligibleReason` starts with `'TOO_EARLY'`.
When nobody is eligible but someone will be, return the existing
`unavailable` miss so the search carries on.

Update the comment on the `NoEligibleGuests` class if its wording no longer
fits.

**Verify**: `pnpm typecheck` → no errors in `auto-book.ts`.

### Step 3: Let the new miss be stored and shown

1. `server/jobs/job.ts`: add `'party-incomplete'` to the `kind` enum of
   `lastAttemptSchema`.
2. `auto-book-messages.ts`: add a case to `attemptMessage`:
   `"Disney's offer didn't include everyone in your party."`

`server/jobs/runner.ts` copies `attempt.kind` into the stored attempt; it
needs no change if the types line up. If `pnpm typecheck` reports an error
there, fix only the type.

**Verify**: `pnpm checkall` → all pass. `pnpm build` → exit 0.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Plan 012 must cover: an offer
missing one requested guest is not booked; a party that is all `TOO_EARLY`
keeps searching; a party that is all `EXPERIENCE_LIMIT_REACHED` ends the
search.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -rn "party-incomplete" src server` returns matches in exactly the three in-scope files
- [ ] `grep -n "coversEveryGuest" src/api/ll/auto-book.ts` returns two lines
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- Plan 001 is not DONE.
- `lastAttemptSchema` is validated somewhere that rejects unknown kinds from
  rows written by an older deploy in a way this change would break. Adding a
  value to an enum must stay backward compatible.
- You find that `ll.offer` already throws when a requested guest is
  ineligible; then step 1 is dead code and you should report instead.

## Maintenance notes

- A search for a party where one guest has permanently dropped out now waits
  until its window closes instead of booking the rest. That is the intended
  trade: a silent partial booking is worse than no booking. The status line
  tells the guest why.
- Plan 005 adds a step between the offer and the booking; the whole-party
  check must stay before it.
