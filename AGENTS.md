# Working in this repository

BG1 is an unofficial Disney Lightning Lane and virtual queue client, hosted
at `https://bg1.abdels.dev` and used by two family members on their phones
inside the parks. A missed or wrong booking costs a real person a ride, so
correctness comes before cleverness.

## Layout

| Folder    | What lives there                                                                        |
| --------- | --------------------------------------------------------------------------------------- |
| `src/`    | The React 19 app (Vite, Tailwind 4). `src/api/` is shared with the server.              |
| `server/` | A Hono server on Node: relay to Disney, auto-book jobs in Postgres (drizzle), web push. |
| `site/`   | Static files served as they are: landing page, app shell, service worker, manifest.     |
| `docs/`   | `docs/design.md`, the design system. Read it before touching any UI.                    |
| `plans/`  | Implementation plans from the last audit, with their status.                            |

`@/` is an alias for `src/`. The server imports shared code from `@/api/...`.
`README.md` explains how the app, the relay and server jobs fit together.

## Commands

Use **pnpm** only. Never npm, npx or yarn.

| Purpose      | Command                     | Expected on success                          |
| ------------ | --------------------------- | -------------------------------------------- |
| Everything   | `pnpm checkall`             | jest passes; eslint, prettier and tsc exit 0 |
| Tests        | `pnpm test`                 | all suites pass                              |
| One test     | `pnpm test <path fragment>` | the matching suites pass                     |
| Lint         | `pnpm lint`                 | exit 0, no output                            |
| Format check | `pnpm format:check`         | "All matched files use Prettier code style!" |
| Format       | `pnpm format`               | exit 0                                       |
| Typecheck    | `pnpm typecheck`            | exit 0, no errors                            |
| Build        | `pnpm build`                | exit 0, files in `dist/`                     |
| Dev server   | `pnpm start`                | `https://localhost:3000/bg1/`                |
| Migration    | `pnpm db:generate`          | a new file in `server/db/migrations/`        |

The design preview, which shows any screen with made-up data, is at
`https://localhost:3000/bg1/preview.html`; `docs/design.md` lists its options.

## Decisions that are settled

- **No rate limits and no job caps.** The service is for a family, not the
  public.
- **No new tests, test files, frameworks or test dependencies unless asked.**
  Keep the existing suite green, and update a test only when a change
  legitimately alters what it asserts.
- **Never log, print or commit** Disney tokens, logins, proxies, guest names
  or other secrets. On the server, log errors through `describeError` from
  `server/describe-error.ts`, which leaves out Disney's answers and query
  parameters.
- **A job's token is only forgotten when the server says the job ended or is
  gone.** It is the only way to stop a search that can still book.
- **A search retries everything that retrying can fix.** Only its time
  window, its login, a final error or the guest ends it.
- **Booking is off; jobs watch and notify.** Disney answers BG1's Lightning
  Lane offers with 403 because it rejects the bot-protection tokens BG1 can
  get. Server jobs therefore watch the tip board and notify
  (`AUTO_BOOK_ACTION=notify`), and the booking screen points to the Disney
  app when an offer is refused. Never try to obtain, generate, replay or
  otherwise work around Disney's bot-protection tokens.

## Code style

Write idiomatic, human-readable TypeScript. Optimize for a person reading the
whole operation, not for fewer lines. A passing formatter is not a
readability review.

- Clear, descriptive names. Small, focused functions. One file per
  responsibility. No `utils`, `helpers` or `types` dumping grounds.
- Guard clauses with braces and early returns instead of nested conditions.
- Every nonempty object literal and object type is multiline, one property
  per line, including one-property objects, nested ones, arguments and return
  values. Empty objects stay compact. Imports and destructuring are exempt.
- Named types for props, options and results.
- No `any`. No non-null assertions. No casts unless the code at that spot
  already needs one for the same reason.
- Validate everything that crosses a boundary (HTTP bodies, database rows,
  storage) with the zod schemas or type guards used nearby.
- Name magic numbers as constants with their unit (`BOOKING_TIMEOUT_MS`).
- Every async task has an owner, a way to cancel it, and exactly one place
  that logs its failure.
- Comments only where behavior is not obvious from the code, as plain
  sentences that explain why. Match the comment density of the file.
- Log messages are lowercase except proper nouns. On the server, log through
  `logger` from `server/log`, never `console`.
- Share code between `src/` and `server/`; never copy it.
- Read a file fully before editing it, and one neighbour as the pattern.

## Git and deploys

- Work on `reconcile`. One commit per logical change; stage only intended
  files, never `git add -A`.
- Messages: a sentence-case imperative subject with no prefix, then a body
  that says why.
- `git push fork reconcile:mickey` deploys to production on Railway, which
  takes about five to seven minutes. Never push a tree where `pnpm checkall`
  or `pnpm build` fails, and never force-push.
- The build command (`pnpm build`), start command (`pnpm serve`) and health
  check (`/health`) are settings of the Railway service, not files in this
  repository.
- A schema change needs a migration (`pnpm db:generate`), which the server
  applies when it starts. The old version keeps serving for a few seconds
  while the new one migrates, so a change the old version can't live with
  should be deployed when nobody is starting a search.
