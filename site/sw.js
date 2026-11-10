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
