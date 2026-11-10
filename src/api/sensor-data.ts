import { serviceUrl } from '@/config';

import { decryptWithAppKey } from './crypto';

const SENSOR_DATA_URL = serviceUrl('sensor/data');

// Disney's bot protection accepts each token for a handful of requests before
// it expects a fresh one.
const MAX_USES_PER_TOKEN = 5;

export class SensorDataUnavailable extends Error {
  name = 'SensorDataUnavailable';
}

// Supplies the Akamai x-acf-sensor-data token that protected Disney endpoints
// require, fetching a new one from the BG1 backend as needed.
class SensorDataSource {
  protected token: Promise<string> = Promise.resolve('');
  protected uses = MAX_USES_PER_TOKEN;

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

  protected async fetchToken(): Promise<string> {
    const response = await fetch(SENSOR_DATA_URL, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new SensorDataUnavailable(
        `sensor data request failed with status ${response.status}`
      );
    }

    const encryptedToken = new Uint8Array(await response.arrayBuffer());

    return decryptWithAppKey(encryptedToken);
  }
}

export const sensorData = new SensorDataSource();
