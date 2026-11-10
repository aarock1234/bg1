import { pushPublicKey } from '@/api/bg1-server';
import type { CreateJobRequest } from '@/api/bg1-server';
import { HOSTS } from '@/config';

const SERVICE_WORKER_URL = '/sw.js';

type PushSubscriptionDetails = NonNullable<
  CreateJobRequest['pushSubscription']
>;

// Notifications need BG1's service worker, which browsers only let BG1's own
// site install. On an iPhone they also need BG1 on the Home Screen, which is
// when the browser offers PushManager at all.
export function canNotify(): boolean {
  return (
    location.origin === HOSTS.HOME &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function toDetails(
  subscription: PushSubscription
): PushSubscriptionDetails | undefined {
  const { endpoint, keys } = subscription.toJSON();

  if (!endpoint || !keys?.p256dh || !keys.auth) {
    return undefined;
  }

  return {
    endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  };
}

async function subscribe(): Promise<PushSubscriptionDetails | undefined> {
  if ((await Notification.requestPermission()) !== 'granted') {
    return undefined;
  }

  await navigator.serviceWorker.register(SERVICE_WORKER_URL);

  const { pushManager } = await navigator.serviceWorker.ready;
  const subscription =
    (await pushManager.getSubscription()) ??
    (await pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: await pushPublicKey(),
    }));

  return toDetails(subscription);
}

// Asks for permission to notify this device and returns what the server needs
// to do so. Returns undefined when notifications aren't possible or the guest
// says no, in which case everything else carries on without them. This has to
// be called from a tap, which is when browsers allow asking.
export async function requestPushSubscription(): Promise<
  PushSubscriptionDetails | undefined
> {
  if (!canNotify()) {
    return undefined;
  }

  try {
    return await subscribe();
  } catch (error) {
    console.warn('push subscription failed', error);

    return undefined;
  }
}
