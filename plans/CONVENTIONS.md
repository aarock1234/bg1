# Conventions for every plan in this folder

Every plan links here. Read this file and `AGENTS.md` at the repository root
in full before starting any plan. Both are part of each plan, not optional
background: `AGENTS.md` holds the layout, the commands, the code style, the
settled decisions and the git and deploy rules; this file holds only what is
specific to executing a plan.

## Tests

Plan 012 is the only plan that adds tests. In every other plan, update an
existing test only when the change legitimately alters what it asserts, and
say so in your report.

## While executing

- Run the plan's drift check first, and read every file it names before
  editing.
- Do not start the server or the dev server, do not call Disney, and do not
  touch Railway unless the plan says so.
- Honor the plan's STOP conditions: stop and report instead of improvising.

## When you finish a plan

1. Run `pnpm checkall` and `pnpm build`; both must succeed.
2. Re-read every file you touched, top to bottom, against the code style.
3. Update the plan's row in `plans/README.md`.
4. Commit, then push to production with `git push fork reconcile:mickey`,
   which the owner has asked for. Confirm the deploy succeeded on Railway and
   that `curl -s https://bg1.abdels.dev/health` answers `{"status":"ok"}`.
   Railway keeps the previous version running if a build fails, so a healthy
   answer alone does not prove the new version is live.
5. Report: what changed, any existing test you updated and why, anything you
   could not verify, and anything you noticed but left alone.
