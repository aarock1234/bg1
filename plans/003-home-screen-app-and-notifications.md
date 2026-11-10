# Plan 003: The Home Screen app opens the app, and notifications behave

> **Executor instructions**: Read `plans/CONVENTIONS.md` first; it is part of
> this plan. Follow the steps in order, run every verification, and stop at
> any STOP condition instead of improvising. When done, update this plan's
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7be6d38..HEAD -- site/manifest.webmanifest site/sw.js`
> If either changed, compare the excerpts below with the live code; a
> mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7be6d38`, 2026-11-10

## Why this matters

On an iPhone, notifications only work when BG1 is added to the Home Screen.
Today the Home Screen icon opens the landing page instead of the app the
guest installed it from, so every launch needs an extra tap. Two smaller
service worker faults sit beside it: tapping a notification can bring the
wrong BG1 window forward, and a push without a payload shows nothing, which
iOS punishes by revoking the subscription.

## Current state

The app is served at `/wdw`, `/dlr`, `/wdw/vq` and `/dlr/vq`; all four serve
`site/app.html`, which links `/manifest.webmanifest`. The landing page is
`/`.

`site/manifest.webmanifest` in full:

```json
{
  "name": "BG1",
  "short_name": "BG1",
  "description": "Unofficial Lightning Lane and virtual queue client",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    {
      "src": "/icon.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

`site/sw.js` in full. It is plain JavaScript served as it is, not built:

```js
'use strict';

// BG1's service worker. Its only job is to show the notification the server
// sends when a search it was running for you ends, and to open BG1 when the
// notification is tapped.

self.addEventListener('push', event => {
  if (!event.data) {
    return;
  }

  const { title, body, url } = event.data.json();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.png',
      data: {
        url,
      },
    })
  );
});

async function openApp(url) {
  const windows = await self.clients.matchAll({
    type: 'window',
  });
  const openWindow = windows.find(client => client.url.startsWith(url));

  if (openWindow) {
    return openWindow.focus();
  }

  return self.clients.openWindow(url);
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(openApp(event.notification.data.url));
});
```

The server always sends `{ title, body, url }`, where `url` is
`https://bg1.abdels.dev/wdw` or `https://bg1.abdels.dev/dlr`.
`client.url.startsWith(url)` therefore also matches a window showing
`/wdw/vq`, the virtual queue app.

## Scope

**In scope**: `site/manifest.webmanifest`, `site/sw.js`.

**Out of scope**: `server/**`, `src/push.ts`, `site/app.html`,
`site/index.html`.

## Steps

### Step 1: Let the installed page be the start page

Remove the `"start_url"` line from `site/manifest.webmanifest`. Without it,
browsers start the installed app at the page it was installed from, which is
the app the guest was using. Leave everything else as it is.

**Verify**: `grep -c "start_url" site/manifest.webmanifest` → `0`.
`pnpm exec prettier --check --parser json site/manifest.webmanifest` → no
syntax error (the file is still valid JSON).

### Step 2: Always show a notification for a push

In the `push` listener, never return without showing something. Extract a
small function that reads the payload and falls back when it is missing or
unreadable:

- title `'BG1'`
- body `'Open BG1 to see how your search is going.'`
- url `self.location.origin`

Name the fallback as one constant object at the top of the file, multiline,
with a comment saying a push that shows nothing can cost the subscription.
Wrap `event.data.json()` in `try`/`catch`; on failure use the fallback.

**Verify**: read the listener: every path reaches `showNotification`.

### Step 3: Focus the right window, and only open BG1's own pages

In `openApp`:

1. Resolve the target with `new URL(url, self.location.origin)`. If its
   `origin` is not `self.location.origin`, use `self.location.origin`
   instead, so a notification can never open another site.
2. Find the open window by comparing `new URL(client.url).pathname` with the
   target's `pathname` exactly, not by prefix.

Keep the functions small and named, in the style of the file.

**Verify**: `grep -n "startsWith" site/sw.js` → no matches.
`node --check site/sw.js` → exits 0.

## Test plan

No new tests. This file has none and is not built or linted today (plan 010
adds `site` to the lint and format commands).

## Done criteria

- [ ] `grep -c "start_url" site/manifest.webmanifest` prints `0`
- [ ] `node --check site/sw.js` exits 0
- [ ] `grep -n "startsWith" site/sw.js` returns nothing
- [ ] `pnpm exec prettier --check site/sw.js` reports no issues
- [ ] `pnpm exec prettier --check --parser json site/manifest.webmanifest` reports no issues
- [ ] `git status --short` lists only in-scope files and `plans/README.md`

## STOP conditions

- The excerpts above don't match the live code.
- `site/app.html` no longer links `/manifest.webmanifest`.

## Maintenance notes

- The Home Screen app on iOS has its own storage, separate from Safari's, so
  each guest signs in again inside it and searches started in Safari are not
  visible there. That is platform behaviour, not a bug.
- A browser keeps a service worker until it sees a byte-different `sw.js`, so
  this change reaches a phone the next time the app is opened online.
- An app already on a Home Screen keeps its old start page; it has to be
  removed and added again from `/wdw` or `/dlr`.
