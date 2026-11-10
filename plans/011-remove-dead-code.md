# Plan 011: Code that does nothing is gone

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**: this plan is driven by searches, not excerpts.
> Run each step's search and confirm the result matches what the step
> expects before deleting anything.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (mechanical, but wide: about 25 files)
- **Depends on**: none; do it after plans 001–008 to avoid editing files they are changing
- **Category**: tech-debt
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

The app was redesigned to be black and white, and auto booking moved to the
server. Both left behind code that still compiles but does nothing: a "theme"
passed through thirteen screens that paints nothing, props that are accepted
and ignored, unused icons and CSS, and duplicated markup. A reader can't tell
what is live, and new code keeps threading the dead concepts through.

**The rule for this whole plan: prove it is unused, then delete it.** Every
deletion is preceded by a search. If a search finds a use this plan didn't
expect, leave that item alone and report it.

## Current state

- `src/components/Screen.tsx` takes a `theme` prop, reads `ThemeContext` and
  re-provides the value. Its own comment says screens "are no longer painted
  in a park's colors". At commit `7be6d38` thirteen non-test components pass
  `theme=`.
- `src/contexts/ThemeContext.ts` defines the context and `DEFAULT_THEME`.
  `src/api/resort.ts` defines a `Theme` class. `src/tailwind-classes.ts`
  exists only to keep theme class names from being stripped. `src/bg1.css`
  defines alias colour tokens for them near the top.
- `src/api/itinerary/booking-converter.ts` imports `DEFAULT_THEME` from the
  React context module, so the API layer (and the server) depends on UI code.
- `src/components/Button.tsx` accepts `color` and `border` and ignores them.
- `src/icons/Icon.tsx` accepts `themed`.
- Reported unused: `src/icons/HeartIcon.tsx`, `src/icons/NewsIcon.tsx`, the
  `ScreenRef` export in `Screen.tsx`, the `JobGuest` export in
  `server/jobs/job.ts`, the CSS classes `dividers` and `row-detail` in
  `src/bg1.css`, and `src/bg1-dev.ts`.
- Duplicated: the guest avatar markup in `src/components/GuestList.tsx`
  (`Avatar`, not exported) and
  `src/components/ll/screens/DasPartyList.tsx`, each with its own
  `AVATAR_SIZE_PX = 36`; the card around `ReturnTime` in
  `src/components/ll/screens/BookExperience/OfferDetails.tsx` duplicates
  `ReturnTimeCard`, exported from `src/components/ll/ReturnTime.tsx`;
  `readJson` is defined identically in `server/http/app.ts` and
  `server/jobs/routes.ts`.

## Scope

**In scope**: the files above, every component that passes `theme=`, the
fixtures and tests that construct a theme, `docs/design.md` where it
describes something this plan deletes.

**Out of scope**:

- `Park.color` / `Land.color` **data** if anything still reads it; only the
  theme plumbing goes.
- `src/responder.html` and its entry in `vite.config.mts`: Disney's login
  loads it by name. Do not remove it.
- `site/autoloader.user.js`: the userscript still works and stays.
- Visual changes of any kind. After this plan every screen must look exactly
  as before.

## Steps

Commit after each step. After each, `pnpm checkall` must pass.

### Step 1: Unused files and exports

For each of `HeartIcon`, `NewsIcon`, `ScreenRef`, `JobGuest`, `bg1-dev`:
`grep -rn "<name>" src server site vite.config.mts package.json`. Delete it
only when the sole matches are its own definition. For `bg1-dev.ts`, also
check `src/*.html` and `README.md`.

**Verify**: `pnpm checkall` → all pass. `pnpm build` → exit 0.

### Step 2: Ignored props

1. `grep -rn "<Button" src --include=*.tsx | grep -n "color=\|border="` →
   expected: no matches. Then remove `color` and `border` from `Button`'s
   props and the code that swallows them.
2. `grep -rn "themed" src --include=*.tsx` → expected: only `Icon.tsx`. Then
   remove `themed` from `Icon`.

**Verify**: `pnpm checkall` → all pass.

### Step 3: The theme

1. Confirm nothing reads a theme's values:
   `grep -rn "theme\.\(bg\|text\|color\)\|use(ThemeContext)\|useContext(ThemeContext)" src --include=*.ts --include=*.tsx | grep -v "\.test\."`
   → expected: only `Screen.tsx`'s `use(ThemeContext)`.
2. Remove the `theme` prop from `Screen` and from every caller
   (`grep -rln "theme=" src --include=*.tsx`).
3. Remove `ThemeContext` providers, the context module, the `Theme` class in
   `src/api/resort.ts`, the `theme` field on parks, lands, `PartyContext` or
   wherever else the type checker then reports it, `DEFAULT_THEME` and its
   import in `booking-converter.ts`, and theme values in `src/__fixtures__`
   and tests.
4. Delete `src/tailwind-classes.ts` and its import, and the alias colour
   tokens in `src/bg1.css` that existed only for those classes. Before
   deleting a token, `grep -rn "<token name>" src` must find no other use.
5. Remove the CSS classes `dividers` and `row-detail` if
   `grep -rn "dividers\|row-detail" src --include=*.tsx` finds them only in
   `src/preview/`; then remove them from the preview too.

Let the type checker lead: delete, run `pnpm typecheck`, fix what it reports,
repeat.

**Verify**: `grep -rn "ThemeContext\|DEFAULT_THEME\|tailwind-classes" src` →
no matches. `pnpm checkall` → all pass. `pnpm build` → exit 0.

### Step 4: Shared pieces instead of copies

1. Export `Avatar` (and its size constant) from one place and use it in
   `DasPartyList.tsx`. Put it in its own file under `src/components/` if two
   unrelated components share it.
2. Make `OfferDetails.tsx` render `ReturnTimeCard` instead of its own card
   wrapper.
3. Keep one `readJson` for the server, in a small module under
   `server/http/`, with the comment the `app.ts` copy has, and import it in
   both places.

**Verify**: `pnpm test GuestList DasPartyList BookExperience` → all pass.
`grep -rn "AVATAR_SIZE_PX = " src` → one line.
`grep -rn "async function readJson" server` → one line.

### Step 5: Prove nothing looks different

Start the dev server in the background (`pnpm start`), and for each of these
preview pages take a screenshot before step 1 and after step 4, at the same
window size, then stop the server:

`https://localhost:3000/bg1/preview.html?app=ll`, `?app=ll&tab=Plans`,
`?app=ll&screen=book`, `?app=ll&screen=booking&id=LL`, `?app=vq`,
`?app=vq&screen=join`, `?app=ll&screen=das-selection`, `?app=kit`.

`docs/design.md` has the exact headless Chrome command under "Screenshots".
(Take the "before" set first, from a clean checkout of the commit you started
at.)

**Verify**: each pair of screenshots is identical. Say in your report how you
compared them.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Tests and fixtures that construct
a theme lose that argument; nothing else about them changes.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -rn "ThemeContext\|DEFAULT_THEME\|tailwind-classes" src` returns nothing
- [ ] `grep -rln "theme=" src --include=*.tsx` returns nothing
- [ ] `grep -rn "AVATAR_SIZE_PX = " src` returns one line
- [ ] The before and after screenshots match
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- Any search finds a use this plan says shouldn't exist. Leave that item and
  report it; carry on with the rest.
- A screenshot pair differs.
- Removing the theme requires changing what a test asserts about behaviour,
  not just its setup.
- The number of test suites or tests drops.

## Maintenance notes

- If parks ever get colours again, add them as design tokens in
  `src/bg1.css`, not as a value threaded through components.
- `docs/design.md` still describes the removed shims until plan 010's step 7
  runs; if 010 is already DONE, update those passages as part of this plan.
