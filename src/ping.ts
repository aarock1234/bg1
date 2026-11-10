import { Resort } from '@/api/resort';
import { serviceUrl } from '@/config';
import { DateTime } from '@/datetime';
import kvdb from '@/kvdb';

const PING_URL = serviceUrl('ping');

// D: Disability Access Service, G: Lightning Lane, V: virtual queue.
type ServiceCode = 'D' | 'G' | 'V';

// Reports anonymous usage of a service, at most once a day per resort. This
// is best effort: a failed report is logged and never rejects.
export async function ping(
  resort: Pick<Resort, 'id'>,
  service: ServiceCode
): Promise<void> {
  const { date } = DateTime.now();
  const lastPingKey = `bg1.ping.${resort.id}.${service}`;

  if (kvdb.get(lastPingKey) === date) {
    return;
  }

  try {
    const response = await fetch(PING_URL, {
      method: 'POST',
      body: new URLSearchParams({
        resort: resort.id,
        service,
      }),
    });

    if (response.ok) {
      kvdb.set(lastPingKey, date);
    }
  } catch (error) {
    console.warn('usage ping failed', error);
  }
}
