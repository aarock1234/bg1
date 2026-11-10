'use strict';

// BG1's service worker. Its only job is to show the notification the server
// sends when a search it was running for you ends, and to open BG1 when the
// notification is tapped.

// What to show when a push arrives without a readable message. Something is
// always shown: browsers take the subscription away from a site whose pushes
// show nothing.
const FALLBACK_NOTIFICATION = {
  title: 'BG1',
  body: 'Open BG1 to see how your search is going.',
  url: self.location.origin,
};

function readNotification(data) {
  if (!data) {
    return FALLBACK_NOTIFICATION;
  }

  try {
    const { title, body, url } = data.json();

    return {
      title: title || FALLBACK_NOTIFICATION.title,
      body: body || FALLBACK_NOTIFICATION.body,
      url: url || FALLBACK_NOTIFICATION.url,
    };
  } catch {
    return FALLBACK_NOTIFICATION;
  }
}

self.addEventListener('push', event => {
  const { title, body, url } = readNotification(event.data);

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

// Returns the page of BG1 a notification points at. An address on any other
// site is replaced by BG1's front page, so a notification can never open
// somewhere else.
function appPage(url) {
  const home = new URL(self.location.origin);

  try {
    const page = new URL(url, home);

    return page.origin === home.origin ? page : home;
  } catch {
    return home;
  }
}

async function openApp(url) {
  const page = appPage(url);
  const windows = await self.clients.matchAll({
    type: 'window',
  });

  // The paths are compared whole: the Lightning Lane app at /wdw is not the
  // virtual queue app at /wdw/vq.
  const openWindow = windows.find(client => {
    return new URL(client.url).pathname === page.pathname;
  });

  if (openWindow) {
    return openWindow.focus();
  }

  return self.clients.openWindow(page.href);
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(openApp(event.notification.data.url));
});
