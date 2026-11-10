const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const TIME_PATTERN = /^([01]?\d|2[0-3])(:[0-5]\d)?(?::[0-5]\d)?$/;

type Duration = {
  hours?: number;
  minutes?: number;
  seconds?: number;
};

type TimeFields = {
  hour: number;
  minute: number;
  second: number;
};

export type ParkTimeable = ParkTime | TimeFields | string;

export type Dateable = Date | number | string;

export type DateFormatType = 'short';

type DateParts = {
  [P in Intl.DateTimeFormatPartTypes]?: string;
};

type ParkDateInput = {
  date: string;
  time?: ParkTime;
};

function clamp(value: number, max: number, min = 0): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function secondsOfDay(time: TimeFields): number {
  return (
    time.hour * SECONDS_PER_HOUR +
    time.minute * SECONDS_PER_MINUTE +
    time.second
  );
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

// A wall-clock time at a park. Times compare through valueOf relative to the
// start of the park day, so 1:00 AM sorts after 11:00 PM.
export class ParkTime {
  static readonly dayStart = new ParkTime(4);

  readonly hour;
  readonly minute;
  readonly second;

  static from(info: ParkTimeable): ParkTime {
    if (typeof info === 'string') {
      const [hour, minute, second] = [...info.split(':').map(Number), 0, 0];

      return new ParkTime(hour, minute, second);
    }

    if (!info) {
      throw new TypeError('Argument must be object or string');
    }

    return new ParkTime(info.hour, info.minute, info.second);
  }

  constructor(hour = 0, minute = 0, second = 0) {
    if (![hour, minute, second].every(Number.isFinite)) {
      throw new RangeError('Invalid time');
    }

    this.hour = clamp(hour, 23);
    this.minute = clamp(minute, 59);
    this.second = clamp(second, 59);
  }

  add(duration: Duration): ParkTime {
    const secondsToAdd = secondsOfDay({
      hour: duration.hours ?? 0,
      minute: duration.minutes ?? 0,
      second: duration.seconds ?? 0,
    });

    if (secondsToAdd === 0) {
      return this;
    }

    const totalSeconds = secondsOfDay(this) + secondsToAdd;
    const hour = Math.floor(totalSeconds / SECONDS_PER_HOUR) % 24;
    const minute = Math.floor(
      (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE
    );
    const second = totalSeconds % SECONDS_PER_MINUTE;

    return new ParkTime(hour, minute, second);
  }

  with(fields: Partial<TimeFields>): ParkTime {
    return new ParkTime(
      fields.hour ?? this.hour,
      fields.minute ?? this.minute,
      fields.second ?? this.second
    );
  }

  // Seconds since the start of the park day.
  valueOf(): number {
    const secondsSinceDayStart =
      secondsOfDay(this) - secondsOfDay(ParkTime.dayStart);

    return (secondsSinceDayStart + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  }

  equals(other: unknown): boolean {
    try {
      return +this === +ParkTime.from(other as ParkTimeable);
    } catch (error) {
      if (error instanceof TypeError) {
        return false;
      }

      throw error;
    }
  }

  toString(): string {
    return [this.hour, this.minute, this.second].map(padTwoDigits).join(':');
  }

  toJSON(): string {
    return this.toString();
  }
}

// Parses a date, treating date-only strings as local midnight.
export function toDate(date: Dateable): Date {
  const isDateOnly = typeof date === 'string' && !date.includes('T');

  return new Date(isDateOnly ? `${date}T00:00:00` : date);
}

export class DateFormat {
  protected formatter;

  constructor(options: Intl.DateTimeFormatOptions) {
    this.formatter = Intl.DateTimeFormat('en-US', options);
  }

  format(date: Dateable): string {
    return this.formatter.format(toDate(date));
  }

  parts(date: Dateable): DateParts {
    const entries = this.formatter
      .formatToParts(toDate(date))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]);

    return Object.fromEntries(entries);
  }
}

// A date and time in the resort's time zone.
export class DateTime {
  readonly date;
  readonly time;

  protected static format: DateFormat;

  static now(): DateTime {
    return DateTime.from(Date.now());
  }

  static from(date: Dateable): DateTime {
    if (typeof date === 'string' && LOCAL_DATE_TIME_PATTERN.test(date)) {
      const [datePart = '', timePart = ''] = date.split('T');

      return new DateTime(datePart, ParkTime.from(timePart));
    }

    const parts = DateTime.format.parts(toDate(date));
    const datePart = `${parts.year}-${parts.month}-${parts.day}`;
    const timePart = `${parts.hour}:${parts.minute}:${parts.second}`;

    return new DateTime(datePart, ParkTime.from(timePart));
  }

  static setTimeZone(timeZone: string): void {
    DateTime.format = new DateFormat({
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  constructor(date: string, time: ParkTime) {
    this.date = date;
    this.time = time;
  }

  toString(): string {
    return `${this.date}T${this.time}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

DateTime.setTimeZone('America/New_York');

// Returns the YYYY-MM-DD date that is `days` away from `date`.
export function modifyDate(date: Dateable, days: number): string {
  const result = toDate(date);
  result.setDate(result.getDate() + days);

  return [result.getFullYear(), result.getMonth() + 1, result.getDate()]
    .map(padTwoDigits)
    .join('-');
}

// Returns the park operating date for a date and time, or the current park
// date. Times before the park day starts belong to the previous date.
export function parkDate(dateTime?: ParkDateInput): string {
  const { date, time = ParkTime.dayStart } = dateTime ?? DateTime.now();
  const isBeforeDayStart = secondsOfDay(time) < secondsOfDay(ParkTime.dayStart);

  if (isBeforeDayStart) {
    return modifyDate(date, -1);
  }

  return date;
}

export function formatDate(date: string, type?: DateFormatType): string {
  const parsed = toDate(date);

  if (isNaN(+parsed)) {
    throw new RangeError(`Invalid date string: ${date}`);
  }

  const monthDay = parsed.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  if (type === 'short') {
    return monthDay;
  }

  const today = parkDate();

  if (date === today) {
    return `Today, ${monthDay}`;
  }

  if (date === modifyDate(today, 1)) {
    return `Tomorrow, ${monthDay}`;
  }

  const weekday = parsed.toLocaleString('en-US', {
    weekday: 'long',
  });

  return `${weekday}, ${monthDay}`;
}

// Formats H[:MM[:SS]] as a 12-hour time, such as 1:30 PM.
export function formatTime(time: unknown): string {
  const match = String(time).match(TIME_PATTERN);

  if (!match) {
    throw new RangeError(`Invalid time string: ${time}`);
  }

  const hour = Number(match[1]);
  const minutes = match[2] ?? '';
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}${minutes} ${period}`;
}

// Returns the times from a sorted list that are not yet in the past.
export function upcomingTimes(times: ParkTime[]): ParkTime[] {
  const now = DateTime.now().time.with({
    second: 0,
  });
  const nextIndex = times.findIndex(time => time >= now);

  if (nextIndex < 0) {
    return [];
  }

  return times.slice(nextIndex);
}
