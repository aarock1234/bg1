/** @jest-environment node */
import type { ResortId } from '@/api/resort';
import { DateTime, ParkTime } from '@/datetime';

import {
  type BookingWindow,
  currentRange,
  isRangeBackward,
  isWindowOver,
  resortNow,
} from './window';

const PARK_DATE = '2021-10-01';
const NEXT_DATE = '2021-10-02';

// Half past ten at night at Walt Disney World and half past seven at
// Disneyland on the park date, when the date in UTC is already the next one.
const EVENING_IN_THE_PARKS = new Date('2021-10-02T02:30:00Z');

type ResortEvening = {
  resortId: ResortId;
  time: string;
};

type WindowAtResort = {
  resortId: ResortId;
  latest: string;
  isOver: boolean;
};

function windowBetween(earliest: string, latest: string): BookingWindow {
  return {
    bookingDate: PARK_DATE,
    earliest,
    latest,
    rollingWaitMinutes: null,
  };
}

function windowUntil(latest: string): BookingWindow {
  return windowBetween('09:00:00', latest);
}

function at(date: string, time: string): DateTime {
  return new DateTime(date, ParkTime.from(time));
}

describe('isRangeBackward()', () => {
  it('accepts a latest time after the earliest', () => {
    expect(isRangeBackward(windowBetween('11:00:00', '12:00:00'))).toBe(false);
  });

  it('accepts a range of a single time', () => {
    expect(isRangeBackward(windowBetween('11:00:00', '11:00:00'))).toBe(false);
  });

  it('refuses a latest time before the earliest', () => {
    expect(isRangeBackward(windowBetween('12:00:00', '11:00:00'))).toBe(true);
  });

  it('accepts a range that crosses midnight', () => {
    expect(isRangeBackward(windowBetween('23:00:00', '01:00:00'))).toBe(false);
  });

  it('refuses a range from after midnight back to the evening before', () => {
    expect(isRangeBackward(windowBetween('01:00:00', '23:00:00'))).toBe(true);
  });

  it('accepts a range that runs up to the end of the park day at 4 AM', () => {
    expect(isRangeBackward(windowBetween('04:00:00', '03:59:59'))).toBe(false);
  });
});

describe('isWindowOver()', () => {
  describe('on the park date', () => {
    it('is not over before the latest return time', () => {
      const now = at(PARK_DATE, '11:59:59');

      expect(isWindowOver(windowUntil('12:00:00'), now)).toBe(false);
    });

    it('is not over at the latest return time itself', () => {
      const now = at(PARK_DATE, '12:00:00');

      expect(isWindowOver(windowUntil('12:00:00'), now)).toBe(false);
    });

    it('is over once the latest return time has passed', () => {
      const now = at(PARK_DATE, '12:00:01');

      expect(isWindowOver(windowUntil('12:00:00'), now)).toBe(true);
    });
  });

  describe('on another date', () => {
    it('is not over the day before', () => {
      const now = at('2021-09-30', '23:00:00');

      expect(isWindowOver(windowUntil('12:00:00'), now)).toBe(false);
    });

    it('is over the day after, however early it is', () => {
      const now = at(NEXT_DATE, '08:00:00');

      expect(isWindowOver(windowUntil('12:00:00'), now)).toBe(true);
    });
  });

  describe('after midnight, when the park day runs on until 4 AM', () => {
    it('is not over for a range that crosses midnight and has not ended', () => {
      const window = windowBetween('23:00:00', '01:00:00');
      const now = at(NEXT_DATE, '00:30:00');

      expect(isWindowOver(window, now)).toBe(false);
    });

    it('is over for a range that crosses midnight once it has ended', () => {
      const window = windowBetween('23:00:00', '01:00:00');
      const now = at(NEXT_DATE, '01:30:00');

      expect(isWindowOver(window, now)).toBe(true);
    });

    it('is over for a range that ended the evening before', () => {
      const now = at(NEXT_DATE, '00:30:00');

      expect(isWindowOver(windowUntil('23:00:00'), now)).toBe(true);
    });

    it('is not over one second before 4 AM for a range that runs that long', () => {
      const now = at(NEXT_DATE, '03:59:58');

      expect(isWindowOver(windowUntil('03:59:59'), now)).toBe(false);
    });

    it('is over at 4 AM, when the next park day starts', () => {
      const now = at(NEXT_DATE, '04:00:00');

      expect(isWindowOver(windowUntil('03:59:59'), now)).toBe(true);
    });
  });
});

describe('resortNow()', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      advanceTimers: false,
      now: EVENING_IN_THE_PARKS,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each<ResortEvening>([
    {
      resortId: 'WDW',
      time: '22:30:00',
    },
    {
      resortId: 'DLR',
      time: '19:30:00',
    },
  ])(
    "tells the time on $resortId's own clock, where it is still the park date",
    ({ resortId, time }) => {
      expect(resortNow(resortId)).toEqual(at(PARK_DATE, time));
    }
  );

  it.each<WindowAtResort>([
    {
      resortId: 'WDW',
      latest: '23:00:00',
      isOver: false,
    },
    {
      resortId: 'DLR',
      latest: '23:00:00',
      isOver: false,
    },
    {
      resortId: 'WDW',
      latest: '21:00:00',
      isOver: true,
    },
    {
      resortId: 'DLR',
      latest: '21:00:00',
      isOver: false,
    },
  ])(
    'judges a window until $latest by the time at $resortId, not by the date in UTC',
    ({ resortId, latest, isOver }) => {
      const now = resortNow(resortId);

      expect(isWindowOver(windowUntil(latest), now)).toBe(isOver);
    }
  );
});

describe('a window that moves with the clock', () => {
  // Started at 3:50 PM for return times until 4:20 PM: a 30 minute wait.
  const movingWindow: BookingWindow = {
    bookingDate: PARK_DATE,
    earliest: '15:50:00',
    latest: '16:20:00',
    rollingWaitMinutes: 30,
  };

  it('accepts the same times as a fixed window at first', () => {
    expect(currentRange(movingWindow, ParkTime.from('15:50'))).toEqual({
      earliest: ParkTime.from('15:50'),
      latest: ParkTime.from('16:20'),
    });
  });

  it('accepts later times as time passes, keeping the same wait', () => {
    expect(currentRange(movingWindow, ParkTime.from('16:00'))).toEqual({
      earliest: ParkTime.from('15:50'),
      latest: ParkTime.from('16:30'),
    });
  });

  it('leaves a fixed window where it is', () => {
    const fixedWindow = windowBetween('15:50:00', '16:20:00');

    expect(currentRange(fixedWindow, ParkTime.from('16:00'))).toEqual({
      earliest: ParkTime.from('15:50'),
      latest: ParkTime.from('16:20'),
    });
  });

  it('stays open after its first latest time has passed', () => {
    const now = new DateTime(PARK_DATE, ParkTime.from('17:00'));

    expect(isWindowOver(movingWindow, now)).toBe(false);
  });

  it('ends once its park day is over', () => {
    const nextDay = new DateTime(NEXT_DATE, ParkTime.from('09:00'));

    expect(isWindowOver(movingWindow, nextDay)).toBe(true);
  });
});
