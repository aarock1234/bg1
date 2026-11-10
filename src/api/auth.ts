import { DateTime, ParkTime } from '@/datetime';
import kvdb from '@/kvdb';

export const AUTH_KEY = 'bg1.auth';

// A token expiring earlier in the day than this would not last through a park
// visit, so it is treated as already expired.
const EARLIEST_SAME_DAY_EXPIRY = new ParkTime(17);

export type AuthData = {
  swid: string;
  accessToken: string;
  expires: number;

  // Lets a new access token be requested without logging in again, when
  // Disney's login provides one.
  refreshToken?: string;
  refreshExpires?: number;
};

export type Credentials = Pick<AuthData, 'swid' | 'accessToken'>;

// Where a client gets the guest's Disney login. `getData` throws ReauthNeeded
// when there is no usable login, and `deleteData` is called when Disney
// rejects the one it was given.
export type Auth = {
  getData(): Credentials;
  deleteData(): void;
};

export class ReauthNeeded extends Error {
  name = 'ReauthNeeded';

  constructor() {
    super('Auth data missing or expired');
  }
}

function isAuthData(stored: unknown): stored is AuthData {
  if (typeof stored !== 'object' || stored === null) {
    return false;
  }

  return (
    'swid' in stored &&
    typeof stored.swid === 'string' &&
    'accessToken' in stored &&
    typeof stored.accessToken === 'string' &&
    'expires' in stored &&
    Number.isFinite(stored.expires)
  );
}

function isStillUsable(expires: number): boolean {
  const expiry = DateTime.from(expires);
  const now = DateTime.now();

  const hasExpired = expiry.toString() <= now.toString();

  if (hasExpired) {
    return false;
  }

  return expiry.date > now.date || expiry.time >= EARLIEST_SAME_DAY_EXPIRY;
}

// The login kept in the browser's local storage.
export class AuthStore implements Auth {
  onUnauthorized: () => void = () => undefined;

  getData(): Credentials {
    const stored = kvdb.get(AUTH_KEY);

    if (isAuthData(stored) && isStillUsable(stored.expires)) {
      return {
        swid: stored.swid,
        accessToken: stored.accessToken,
      };
    }

    this.deleteData();
    throw new ReauthNeeded();
  }

  setData(data: AuthData): void {
    kvdb.set(AUTH_KEY, data);
  }

  deleteData(): void {
    kvdb.delete(AUTH_KEY);
    setTimeout(this.onUnauthorized);
  }
}

export const authStore = new AuthStore();
