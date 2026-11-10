import { parkDate } from './datetime';

// A stored value that is only valid for the park day it was saved on.
type DailyValue = {
  value: unknown;
  date: string;
};

function isDailyValue(stored: unknown): stored is DailyValue {
  return (
    typeof stored === 'object' &&
    stored !== null &&
    'value' in stored &&
    'date' in stored
  );
}

// A JSON key-value store backed by localStorage. Reads return unknown because
// stored data can come from an older version of the app; callers validate it.
export default {
  get(key: string): unknown {
    const json = localStorage.getItem(key);

    if (json === null) {
      return undefined;
    }

    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  },

  set(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
  },

  delete(key: string): void {
    localStorage.removeItem(key);
  },

  clear(): void {
    localStorage.clear();
  },

  getDaily(key: string): unknown {
    const stored = this.get(key);

    if (!isDailyValue(stored) || stored.date !== parkDate()) {
      return undefined;
    }

    return stored.value;
  },

  setDaily(key: string, value: unknown): void {
    const daily: DailyValue = {
      value,
      date: parkDate(),
    };

    this.set(key, daily);
  },
};
