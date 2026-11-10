import { SensorDataSource, fetchTokenFromService } from '@/api/sensor-data';

import { env } from '../config/env';

// Returns the bot-protection token the server sends Disney. Disney refuses
// the tokens the BG1 backend hands out for offers and bookings, but accepts
// one captured from the official app for some time after, so a captured
// token, when one is set, is used in place of the backend's.
export async function serverSensorToken(): Promise<string> {
  if (env.DISNEY_SENSOR_DATA) {
    return env.DISNEY_SENSOR_DATA;
  }

  return fetchTokenFromService();
}

// The token source for every Disney client the server creates.
export const serverSensorData = new SensorDataSource(serverSensorToken);
