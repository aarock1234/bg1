# Plan 009: Deploy settings live in the format Railway will keep reading

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7be6d38..HEAD -- railway.json`
> and `ls .railway` (expected: no such directory).

## Status

- **Priority**: P2 (hard deadline: 2026-12-01)
- **Effort**: S
- **Risk**: MED (it changes how production is built and started)
- **Depends on**: none; do it when no other plan is mid-deploy
- **Category**: migration
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

Production is built and started according to `railway.json`. Railway has
announced that it stops reading that file on 2026-12-01; the replacement is
`.railway/railway.ts`, applied with Railway's CLI. If nothing is done, a
deploy after that date falls back to defaults: possibly no `pnpm build`, the
wrong start command, and no health check to gate the switch-over, which the
server relies on to hand running searches to the new version.

**This information is second-hand.** It comes from an earlier session's
reading of the CLI's output, not from Railway's documentation as read while
writing this plan. Step 1 exists to confirm it.

## Current state

`railway.json` in full:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "buildCommand": "pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm serve",
    "healthcheckPath": "/health"
  }
}
```

- Railway project `bg1`, deploying branch `mickey` of GitHub
  `aarock1234/bg1` on every push.
- The `railway` CLI is installed (version 5.71.0 when last checked) and
  logged in on the owner's machine. This repository is **not linked** to the
  project: `railway config migrate` answered "No linked project found".
- The service has variables holding secrets (database URL, encryption key,
  push keys, proxies). They must never be written into a file or printed.

## Scope

**In scope**: `.railway/railway.ts` (create), `railway.json` (delete, last),
`package.json` and `pnpm-lock.yaml` only if Railway's tooling requires a dev
dependency.

**Out of scope**: Railway variables, domains, the Postgres service, the
branch being deployed.

## Steps

### Step 1: Confirm the facts

Read Railway's current documentation for config as code (search their docs
for "railway.ts" and "config migrate"; the Railway MCP server has a docs
search tool if it is available to you). Confirm: the deadline, the file's
path and shape, and the CLI commands. Write what you confirmed, with links,
into your report.

**Verify**: you can state, with a source, what replaces each of
`buildCommand`, `startCommand` and `healthcheckPath`.

### Step 2: Link and dry-run

1. `railway link`, choosing project `bg1`, its production environment and
   the `bg1` service (not Postgres).
2. `railway config migrate --variables=unmanaged` as a dry run. `unmanaged`
   keeps variables out of the generated file.

**Verify**: the dry run prints a config that contains the build command, the
start command and the health check, and **no variable values**.

### Step 3: Write the file and compare

1. Run the same command with `--apply` to write `.railway/railway.ts`.
2. If the CLI asks for a dev dependency for types, add it with
   `pnpm add -D <package>`.
3. `railway config plan`.

**Verify**: the plan shows no changes beyond build, start and health check,
and nothing about variables, domains or the database. Read
`.railway/railway.ts` and confirm it holds no secret.

### Step 4: Switch over, then remove the old file

1. `railway config migrate cutover` (its `undo` reverts it).
2. `railway config apply`.
3. Commit `.railway/railway.ts` and any `package.json` / lockfile change.
   Push as `plans/CONVENTIONS.md` describes.
4. Watch that deploy on Railway: it must build with `pnpm build`, start with
   `pnpm serve`, pass the `/health` check, and
   `curl -s https://bg1.abdels.dev/health` must answer `{"status":"ok"}`.
5. Only then delete `railway.json`, commit, push, and confirm a second
   healthy deploy.

**Verify**: two successful deploys, the second without `railway.json`.

## Test plan

None; this is configuration.

## Done criteria

- [ ] `.railway/railway.ts` exists and contains no secret values
- [ ] `railway.json` no longer exists
- [ ] `pnpm checkall` exits 0
- [ ] The latest Railway deployment of the `bg1` service is successful and `curl -s https://bg1.abdels.dev/health` prints `{"status":"ok"}`
- [ ] Your report links the Railway documentation you relied on

## STOP conditions

- Railway's documentation contradicts this plan (different path, different
  commands, no deadline). Report what it says instead of proceeding.
- Any command wants to write variable values into a file, or the plan in
  step 3 shows a change to variables, domains or the database.
- A deploy fails or the health check stops answering: run the cutover's
  `undo`, restore `railway.json` if it was deleted, and report.
- The CLI is not logged in. Logging in needs the owner.

## Maintenance notes

- After this, changing how the app builds or starts means editing
  `.railway/railway.ts` and running `railway config apply`; a push alone may
  no longer pick the change up. Say so in `README.md` (plan 010 owns that
  file; tell the operator if 010 is already done).
- The start command runs the server through `pnpm` and `tsx`. Whether the
  shutdown signal reaches the server through both wrappers has not been
  confirmed; if deploy logs never show `shutting down`, searches resume about
  30 seconds late after each deploy. Starting node directly would fix that
  and is a separate change.
