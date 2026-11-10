# Conventions for every plan in this folder

Every plan links here. Read this file in full before starting any plan. It is
part of each plan, not optional background.

## What this repository is

BG1 is an unofficial Disney Lightning Lane and virtual queue client, hosted at
`https://bg1.abdels.dev` and used by two family members on their phones inside
the parks. A missed or wrong booking costs a real person a ride, so
correctness comes before cleverness.

| Folder    | What lives there                                                                        |
| --------- | --------------------------------------------------------------------------------------- |
| `src/`    | The React 19 app (Vite, Tailwind 4). `src/api/` is shared with the server.              |
| `server/` | A Hono server on Node: relay to Disney, auto-book jobs in Postgres (drizzle), web push. |
| `site/`   | Static files served as they are: landing page, app shell, service worker, manifest.     |
| `docs/`   | `docs/design.md`, the design system. Read it before touching any UI.                    |

`@/` is an alias for `src/`. The server imports shared code from `@/api/...`.

## Commands

Use **pnpm** only. Never npm, npx or yarn.

| Purpose      | Command                     | Expected on success                          |
| ------------ | --------------------------- | -------------------------------------------- |
| Everything   | `pnpm checkall`             | jest passes, eslint, prettier, tsc exit 0    |
| Tests        | `pnpm test`                 | all suites pass                              |
| One test     | `pnpm test <path fragment>` | the matching suites pass                     |
| Lint         | `pnpm lint`                 | exit 0, no output                            |
| Format check | `pnpm format:check`         | "All matched files use Prettier code style!" |
| Format       | `pnpm format`               | exit 0                                       |
| Typecheck    | `pnpm typecheck`            | exit 0, no errors                            |
| Build        | `pnpm build`                | exit 0, files in `dist/`                     |

At the time these plans were written `pnpm checkall` passed with 61 suites and
262 tests.

Do not start the server or the dev server, do not call Disney, and do not
touch Railway unless the plan says so.

## Code style (the owner reviews for this; a passing formatter is not enough)

Write idiomatic, beautiful, human-readable TypeScript. Optimize for a person
reading the whole operation, not for fewer lines.

- Clear, descriptive names. Small, focused functions. One file per
  responsibility. No `utils`, `helpers` or `types` dumping grounds.
- Guard clauses with braces and early returns instead of nested conditions.
- **Every nonempty object literal and object type is multiline, one property
  per line**, including one-property objects, nested ones, arguments and
  return values. Empty objects stay compact. Imports and destructuring are
  exempt.
- Named types for props, options and results. No inline anonymous shapes in
  signatures.
- No `any`. No non-null assertions (`!`). No `as` casts unless the existing
  code at that spot already needs one for the same reason.
- Validate everything that crosses a boundary (HTTP bodies, database rows,
  storage) with the zod schemas or type guards already used nearby.
- Name magic numbers as constants with their unit (`SENSOR_DATA_TIMEOUT_MS`).
- Every async task has an owner, a way to cancel it, and exactly one place
  that logs its failure.
- Comments only where behavior is not obvious from the code, written as plain
  sentences that explain why. Match the comment density of the file.
- Log messages are lowercase except proper nouns: `'job check interrupted'`.
  On the server, log through `logger` from `server/log`, never `console`.
- Never log, print or commit Disney tokens, logins, proxies, guest names or
  other secrets.
- Share code between `src/` and `server/`; never copy it.
- Match the surrounding file: read it fully before editing, and read one
  neighbouring file as the pattern.

A short example of the expected shape:

```ts
type RetryOptions = {
  attempts: number;
  delayMs: number;
};

function isRetryable(error: unknown): boolean {
  if (!(error instanceof RequestError)) {
    return false;
  }

  return error.response.status >= STATUS_SERVER_ERROR;
}
```

## Tests

The owner's rule is: no new tests, test files, frameworks or test
dependencies unless a plan explicitly says to add them. Plan 012 is the only
plan that adds tests. In every other plan, update an existing test only when
the change legitimately alters what it asserts, and say so in your report.
The existing suite must stay green.

## Git

- Work on the current branch, `reconcile`. Do not create other branches.
- One commit per plan, or per logical step when a plan says so. Stage only
  the files the plan lists; never `git add -A`.
- Message style, from this repo's history: a sentence-case imperative subject
  with no prefix, then a body that says why.

  ```
  Remove the job cap and rate limits

  The server is for a family, not the public, so a search is never turned
  down for being one too many and no route is metered.
  ```

- **Push to production when a plan is done.** The owner has asked for this.
  After a plan's done criteria all hold and it is committed, run
  `git push fork reconcile:mickey`. That push deploys to production on
  Railway (a deploy takes about five to seven minutes). Never push a tree
  where `pnpm checkall` or `pnpm build` fails, never force-push, and never
  push anything but the `reconcile` branch to `mickey`.
- After pushing, confirm production still answers:
  `curl -s https://bg1.abdels.dev/health` → `{"status":"ok"}`. Railway keeps
  the previous version running if a build fails, so a healthy answer does not
  prove the new version is live; say in your report that the deploy itself
  was not confirmed unless you checked it on Railway.

## When you finish a plan

1. Run `pnpm checkall` and `pnpm build`; both must succeed.
2. Re-read every file you touched, top to bottom, against the style rules.
3. Update the plan's row in `plans/README.md`.
4. Commit, then push to production as described under Git.
5. Report: what changed, any existing test you updated and why, anything you
   could not verify, and anything you noticed but left alone.
