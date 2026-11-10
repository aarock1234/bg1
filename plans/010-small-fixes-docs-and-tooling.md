# Plan 010: Small faults fixed, the docs tell the truth, and every file is checked

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7be6d38..HEAD -- README.md docs/design.md package.json vite.config.mts src/components/App.tsx src/components/LoginForm.tsx src/components/ll/screens/SelectReturnTime.tsx`
> Plan 007 removes three lines from `LoginForm.tsx`; that is expected.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (do it after plans 001–009 so the README describes the final behaviour)
- **Category**: bug, docs, dx
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

A handful of small things that each cost a little: a typo guests see, two
dead ends where a failed load leaves a spinner forever, a README that says
the opposite of what the server does, a design guide still written as a
migration in progress, files that no check ever looks at, and no written
guidance for the next person or agent.

## Current state and steps

Commit after each step.

### Step 1: Fix the typo

`src/components/ll/screens/SelectReturnTime.tsx:473`:

```tsx
<h3 className="mt-0">Availabile Times</h3>
```

Change it to `Available Times`. Check for a test that matches the misspelt
text: `grep -rn "Availabile" src`.

**Verify**: `grep -rn "Availabile" src` → no matches.
`pnpm test SelectReturnTime` → all pass.

### Step 2: Let a failed login script be retried

`src/components/LoginForm.tsx`: the script that shows Disney's login is
loaded once and the promise is cached forever:

```ts
function loadSession(resortId: string): Promise<OneIdSession> {
  sessionPromise ??= createSession(resortId);

  return sessionPromise;
}
```

```ts
  return new Promise(resolve => {
    script.addEventListener('load', () => {
      resolve();
    });
  });
```

If the script fails to load (weak signal), the promise never settles and the
guest sees the login screen's text with no form until they reload.

1. In `loadOneIdScript`, reject on the script's `error` event with an
   `Error('OneID script failed to load')`, and remove the failed `<script>`
   element so a retry can add a fresh one.
2. In `loadSession`, clear `sessionPromise` when it rejects, so the next
   attempt starts over.
3. In the `LoginForm` component, on failure show a way to try again instead
   of only logging. Use the existing building blocks: read `docs/design.md`
   and `src/components/ll/screens/BookExperience/NoGuestsFound.tsx`, which
   is a calm message with a "Try Again" button, and match it. Text:
   heading `Couldn't Load Disney's Login`, body
   `Check your connection and try again.`, button `Try Again`.

**Verify**: `pnpm test LoginForm` and `pnpm test App` → all pass.

### Step 3: Let a failed start be retried

`src/components/App.tsx`, in the effect that starts the app:

```ts
startApp().catch(error => {
  console.error(error);
});
```

When loading fails the guest is left on the startup spinner. Add state for
the failure and, when set, render the same kind of message as step 2 in
place of the spinner: heading `BG1 Couldn't Start`, body
`Check your connection and try again.`, button `Try Again`, which runs the
start again. Do not change the routing, auth or loading logic otherwise.
If steps 2 and 3 produce the same markup, extract one small component and
use it in both.

**Verify**: `pnpm test App` → all pass.

### Step 4: Fix the build inputs vite can't resolve in dev

`vite.config.mts` sets `root: 'src'` and lists inputs as `'src/bg1.tsx'`
and so on. The dev server resolves them against the root, looks for
`src/src/...`, and warns on every start. `sourceDirectory` already exists at
the top of the file. Build each input path from it with `path.join`.

Also fix the comment above `server`, which says the dev server uses HTTPS
"because BG1 is loaded into Disney's pages": that is now only one of two
ways the app runs.

**Verify**: `pnpm build` → exit 0, and `ls dist` shows the same file names
as before the change (`bg1.js`, `bg1.css`, `home.js`, `responder.html`, plus
chunks). Record the listing before and after.

### Step 5: Check every source file

`package.json`: `lint`, `lint:fix`, `format` and `format:check` cover
`src server drizzle.config.ts` only. Add `site`, `vite.config.mts`,
`eslint.config.mjs`, `jest.config.js` and `plans` (for prettier only; markdown
is not linted) to the right commands. Run `pnpm format`, then fix what
`pnpm lint` reports in the newly covered files. If eslint needs
configuration for the plain scripts in `site/` (service worker and
userscript globals), add it to `eslint.config.mjs` in the style already
there; do not disable rules wholesale.

**Verify**: `pnpm checkall` → all pass.

### Step 6: Make the README true

`README.md` contradicts the code in these places:

- Line 9: "Auto booking only runs while that screen stays open." It runs on
  the server with the phone closed.
- Line 18: "Its API is open and rate limited per visitor". There are no rate
  limits, by decision.
- Line 22: presents the userscript as the way in. The app is used at
  `https://bg1.abdels.dev/wdw`, `/dlr`, `/wdw/vq` and `/dlr/vq` with nothing
  to install; the userscript still works but is no longer the main path.
- Line 24: calls `/wdw` etc. short links to Disney's pages. They serve the
  app. The short links are `/install` and `/server`
  (`server/http/short-links.ts`).
- The variable table says `DISNEY_REQUESTS_PER_SECOND` is `8` at the default
  pace. Check `server/disney/pace.ts`: it is
  `MAX_REQUESTS_PER_CHECK * 2`; write the value that is true now.

Rewrite "About this fork", the `pnpm serve` bullet and the paragraph about
links accordingly. Add a short "How it works" paragraph: the app on BG1's
site, the relay, server jobs, push notifications. Keep the warning, the
acknowledgments and the variable table. Plain, short sentences.

**Verify**: `grep -n "rate limited\|only runs while" README.md` → no matches.

### Step 7: Bring the design guide up to date

`docs/design.md` was written while the redesign was in progress. Fix:

- Line ~351: "The real app only runs inside Disney's pages". It runs on
  BG1's own site.
- Lines ~69-70: says `src/bg1.tsx` sets the viewport "because the userscript
  leaves an empty document"; `site/app.html` sets it for the main path.
- Passages written as migration instructions ("two finished screens",
  "remove them from your callers", "stop passing it"): the redesign is
  finished. State the final rules instead. If plan 011 is DONE, the theme
  and `color`/`border` shims are gone; describe what exists.

**Verify**: `grep -n "only runs inside Disney" docs/design.md` → no matches.

### Step 8: Write down how to work here

Create `AGENTS.md` at the repository root: what the project is, the folder
layout, the commands, the code style, the decided trade-offs (no rate limits
or job caps; no new tests unless asked; pnpm only; never log secrets), a
pointer to `docs/design.md`, and how deploys happen. `plans/CONVENTIONS.md`
has most of this; move the lasting parts into `AGENTS.md` and leave
`plans/CONVENTIONS.md` holding only what is specific to executing plans,
linking to `AGENTS.md`.

Create `.env.example` listing every variable from `server/config/env.ts`
with a comment on its format and **no values**.

**Verify**: `grep -c "=" .env.example` equals the number of variables in
`server/config/env.ts`, and no line has anything after its `=`.

## Scope

**In scope**: the files named in the steps, plus `eslint.config.mjs`,
`AGENTS.md` and `.env.example` (create), and `site/**` only for what step 5's
formatter and linter require.

**Out of scope**: behaviour of the server; `server/config/env.ts`; the
`tls/` directory; anything plans 001–009 or 011 own.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Update existing `App` or
`LoginForm` tests only where steps 2 and 3 change what they assert.

## Done criteria

- [ ] `pnpm checkall` exits 0 (now covering `site` and the root config files)
- [ ] `pnpm build` exits 0 with the same output file names as before
- [ ] `grep -rn "Availabile" src` returns nothing
- [ ] `grep -n "rate limited\|only runs while" README.md` returns nothing
- [ ] `AGENTS.md` and `.env.example` exist; `.env.example` holds no values
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- Step 4 changes any output file name in `dist/`: `site/app.html` and the
  userscript load those files by name.
- Step 5's linter wants changes to how `site/sw.js` or
  `site/autoloader.user.js` behave, not just how they are written.
- A string you are asked to add already exists with different wording.

## Maintenance notes

- The three new messages are user-facing text the owner has not seen; list
  them in your report so he can reword them.
- `AGENTS.md` is now the single statement of the rules; keep
  `plans/CONVENTIONS.md` thin.
