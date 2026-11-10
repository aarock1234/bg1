import { WebPushError, sendNotification } from 'web-push';
import { z } from 'zod';

import { env } from '../config/env';
import { logger } from '../log';

const STATUS_NOT_FOUND = 404;
const STATUS_GONE = 410;

// How long a push service keeps a notification for a phone that is offline.
const TIME_TO_LIVE_SECONDS = 4 * 60 * 60;

const SEND_TIMEOUT_MS = 10_000;

// The push services of the browsers BG1 runs in. The server sends requests
// to the address a subscription names, so it only accepts addresses on these
// hosts.
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

function isPushServiceUrl(endpoint: string): boolean {
  const { protocol, hostname } = new URL(endpoint);

  if (protocol !== 'https:') {
    return false;
  }

  return PUSH_SERVICE_HOSTS.some(host => {
    return hostname === host || hostname.endsWith(`.${host}`);
  });
}

// A browser's push subscription, as `PushSubscription.toJSON()` returns it.
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().refine(isPushServiceUrl, {
    error: 'is not a known push service',
  }),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscription = z.infer<typeof pushSubscriptionSchema>;

// What the app's service worker shows, and the page it opens when tapped.
export type PushMessage = {
  title: string;
  body: string;
  url: string;
};

// Whether the push service says the subscription no longer exists.
function isGone(error: unknown): boolean {
  if (!(error instanceof WebPushError)) {
    return false;
  }

  return (
    error.statusCode === STATUS_NOT_FOUND || error.statusCode === STATUS_GONE
  );
}

// Sends one notification. Nothing depends on it arriving, so a failure is
// logged here and never thrown.
export async function sendPush(
  subscription: PushSubscription,
  message: PushMessage
): Promise<void> {
  try {
    await sendNotification(subscription, JSON.stringify(message), {
      vapidDetails: {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      },
      TTL: TIME_TO_LIVE_SECONDS,
      timeout: SEND_TIMEOUT_MS,
    });
  } catch (error) {
    if (isGone(error)) {
      logger.info('push subscription is gone');
      return;
    }

    // The error itself holds the subscription's address, which identifies
    // the guest's browser, so only its kind and status are logged.
    logger.warn(
      {
        errorName: error instanceof Error ? error.name : 'unknown',
        status: error instanceof WebPushError ? error.statusCode : undefined,
      },
      'push notification failed'
    );
  }
}
