# Plan 006: The relay only ever reaches Disney, and its answers can't run as pages

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7be6d38..HEAD -- server/http/relay.ts src/api/client.ts`
> If either changed, compare the excerpts below with the live code; a
> mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

Browsers won't let BG1's own site call Disney, so the app sends each request
to the server's relay at `/api/relay/<disney host>/<path>`, which forwards it
with the guest's `Authorization` header. The relay is the one place where the
server makes requests to an address a visitor chose, and the app's origin is
where guests' Disney logins are stored. Three gaps exist: the address is
built in a way that can slip past the host allow-list, redirects are followed
to any host, and whatever Disney answers (including HTML) is returned on
BG1's origin where a browser would run it. A fourth, small fault makes the
app reuse a bot-protection token Disney has already rejected.

## Current state

`server/http/relay.ts:51-85`:

```ts
  relay.all('/:host/*', async context => {
    const host = context.req.param('host');

    if (!ALLOWED_HOSTS.has(host)) {
      return context.json(
        {
          error: 'host not allowed',
        },
        403
      );
    }

    const { pathname, search } = new URL(context.req.url);
    const hostSegment = `/${host}/`;
    const path = pathname.slice(
      pathname.indexOf(hostSegment) + hostSegment.length - 1
    );
    const { method } = context.req;

    try {
      const response = await fetch(`https://${host}${path}${search}`, {
        method,
        headers: forwardedHeaders(context.req.raw.headers),
        body: METHODS_WITHOUT_BODY.has(method)
          ? undefined
          : await context.req.arrayBuffer(),
        signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
      });

      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') ?? 'text/plain',
        },
      });
```

The problems, concretely:

1. `param('host')` is percent-decoded by the router, but `pathname` is raw.
   When the two differ, `indexOf` returns `-1`, the slice starts at an
   arbitrary offset, and the text glued after `https://${host}` may not begin
   with `/`, which makes it part of the host name.
2. `fetch` follows redirects by default, to any host.
3. Disney's `Content-Type` is passed through, so an HTML answer opened as a
   link renders, and runs scripts, as `bg1.abdels.dev`.

A dropped upstream connection is answered with 502 (`relay.ts:95-100`).

`src/api/client.ts:143-156`, how the client decides a token was rejected:

```ts
  protected handleFailure(request: ApiRequest, status: number): void {
    if (status === STATUS_UNAUTHORIZED && !request.ignoreUnauth) {
      setTimeout(() => this.auth.deleteData());
      return;
    }

    // Disney answers a rejected sensor token with 403 or drops the connection.
    const isSensorDataRejected =
      status === STATUS_FORBIDDEN || status === STATUS_NETWORK_FAILURE;

    if (request.sensorData && isSensorDataRejected) {
      this.sensorData.reset();
    }
  }
```

Through the relay a dropped connection arrives as 502, not status 0, so the
token is not reset and is reused for up to four more requests.

The app's clients only read JSON answers: `src/fetch.ts` returns `{}` for any
answer whose `Content-Type` does not start with `application/json`.

## Scope

**In scope**: `server/http/relay.ts`, `src/api/client.ts` (only
`handleFailure` and its status constants).

**Out of scope**:

- `FORWARDED_HEADERS` and `ALLOWED_HOSTS`: both are correct.
- `server/http/app.ts`, including CORS.
- Rate limits: the owner has decided the API has none. Do not add any.
- `src/api/relay.ts`, the browser side.

## Steps

### Step 1: Build the address from the checked host

Replace the slicing with a function that returns the upstream `URL` or
`undefined`:

1. Take the raw `pathname`. Compute the prefix the relay is mounted at plus
   the host: find `/${host}/` in the raw pathname. If it is not found
   (`indexOf` is `-1`), return `undefined`.
2. Build `new URL(path + search, `https://${host}`)`.
3. Return it only when `target.protocol === 'https:'` and
   `target.host === host`; otherwise `undefined`.

In the handler, answer 400 with `{ error: 'invalid path' }` (multiline, as
the file's other answers) when it returns `undefined`, and fetch the returned
`URL`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Don't follow redirects

Pass `redirect: 'manual'` to the `fetch`. A redirect then comes back as a 3xx
answer, which is relayed like any other status. Do not forward the `Location`
header.

**Verify**: `grep -n "redirect: 'manual'" server/http/relay.ts` → one line.

### Step 3: Make every relayed answer inert in a browser

Return these headers on every relayed answer, defined once as a named
constant object with a comment saying why (the answers are data for the app,
and must never run as a page on the origin that holds guests' logins):

- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: sandbox; default-src 'none'`

Keep passing through Disney's `Content-Type`.

**Verify**: `grep -n "nosniff\|sandbox" server/http/relay.ts` → two lines.

### Step 4: Treat a relayed dropped connection as a rejected token

In `src/api/client.ts` add `const STATUS_BAD_GATEWAY = 502;` and include it
in `isSensorDataRejected`. Update the comment: on BG1's own site a dropped
connection reaches the app as the relay's 502.

**Verify**: `pnpm checkall` → all pass. `pnpm build` → exit 0.

## Test plan

No new tests (see `plans/CONVENTIONS.md`). Plan 012 lists the relay's address
building as a unit worth covering once it is a pure function, which step 1
makes it.

## Done criteria

- [ ] `pnpm checkall` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "indexOf(hostSegment) +" server/http/relay.ts` returns nothing
- [ ] `grep -n "target.host === host\|\.host === host" server/http/relay.ts` returns one line
- [ ] `grep -n "redirect: 'manual'" server/http/relay.ts` returns one line
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- The excerpts above don't match the live code.
- You find a client in `src/api/` that relies on a redirect being followed
  (`grep -rn "redirect" src/api`). None is known.
- An existing test for `ApiClient` asserts that a 502 does **not** reset the
  token.

## Maintenance notes

- After deploying, the operator should confirm in a browser that the
  Lightning Lane list still loads at `https://bg1.abdels.dev/dlr` or `/wdw`,
  which exercises the relay end to end.
- If a Disney service ever answers with a redirect the app needs, relay the
  3xx and let the client decide; do not turn following back on.
- The app shell and static pages still have no Content-Security-Policy. That
  is a larger change (Disney's login runs in an iframe and loads Disney's
  script) and is left out here.
