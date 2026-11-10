import { HOSTS } from '@/config';

import type { ApiClientOptions } from './client';
import { SensorDataSource, SensorDataUnavailable } from './sensor-data';

const RELAY_URL = `${HOSTS.HOME}/api/relay`;
const SENSOR_DATA_URL = `${HOSTS.HOME}/api/sensor-data`;

// Sends a request to Disney by way of BG1's server. A page on BG1's own site
// can't call Disney itself, because Disney only answers its own pages.
const relayFetch: typeof fetch = (input, init) => {
  const target = new URL(input instanceof Request ? input.url : input);
  const relayedUrl = `${RELAY_URL}/${target.host}${target.pathname}${target.search}`;

  return fetch(relayedUrl, init);
};

// The BG1 backend that hands out bot-protection tokens doesn't answer pages
// on BG1's own site either, so the server fetches them on the page's behalf.
async function fetchTokenFromServer(): Promise<string> {
  const response = await fetch(SENSOR_DATA_URL, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new SensorDataUnavailable(
      `sensor data request failed with status ${response.status}`
    );
  }

  return response.text();
}

// Client options that route everything through BG1's server, for running the
// app on BG1's own site.
export const RELAY_OPTIONS: ApiClientOptions = {
  fetch: relayFetch,
  sensorData: new SensorDataSource(fetchTokenFromServer),
};
