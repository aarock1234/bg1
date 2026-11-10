import { serviceUrl } from '@/config';

import { decryptWithAppKey } from './crypto';

const SENSOR_DATA_URL = serviceUrl('sensor/data');

// Disney's bot protection accepts each token for a handful of requests before
// it expects a fresh one.
const MAX_USES_PER_TOKEN = 5;

// How long the backend gets to answer. A request waiting for a token can't
// time out on its own, so without this a hung fetch would stall it for good.
const SENSOR_DATA_TIMEOUT_MS = 8000;

export class SensorDataUnavailable extends Error {
  name = 'SensorDataUnavailable';
}

// Fetches a new token straight from the BG1 backend, which only answers
// Disney's pages and servers.
export async function fetchTokenFromService(): Promise<string> {
  const response = await fetch(SENSOR_DATA_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(SENSOR_DATA_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new SensorDataUnavailable(
      `sensor data request failed with status ${response.status}`
    );
  }

  const encryptedToken = new Uint8Array(await response.arrayBuffer());

  return decryptWithAppKey(encryptedToken);
}

// Supplies the Akamai x-acf-sensor-data token that protected Disney endpoints
// require, fetching a new one as needed.
export class SensorDataSource {
  protected token: Promise<string> = Promise.resolve('');
  protected uses = MAX_USES_PER_TOKEN;

  constructor(protected fetchToken: () => Promise<string>) {}

  get(): Promise<string> {
    this.uses += 1;

    if (this.uses > MAX_USES_PER_TOKEN) {
      this.uses = 1;
      this.token = this.fetchToken().catch((error: unknown) => {
        this.reset();
        throw error;
      });
    }

    return this.token;
  }

  // Makes the next request fetch a fresh token, such as after Disney rejects
  // the current one.
  reset(): void {
    this.uses = MAX_USES_PER_TOKEN;
  }
}

export const sensorData = new SensorDataSource(fetchTokenFromService);
