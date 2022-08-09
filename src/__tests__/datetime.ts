import { dateTimeStrings, displayTime, setDefaultTimeZone } from '../datetime';

Date.now = jest
  .spyOn(Date, 'now')
  .mockImplementation(() => 1633089600000) as unknown as () => number;

describe('dateTimeStrings()', () => {
  it('parses Date object', () => {
    expect(dateTimeStrings(new Date(893277340752))).toEqual({
      date: '1998-04-22',
      time: '16:35:40',
    });
  });

  it('returns current datetime with no argument', () => {
    expect(dateTimeStrings()).toEqual({
      date: '2021-10-01',
      time: '08:00:00',
    });
  });
});

describe('displayTime()', () => {
  it('formats time for display', () => {
    expect(displayTime('08:14:42')).toBe('8:14:42 AM');
    expect(displayTime('08:14')).toBe('8:14 AM');
    expect(displayTime('08:14:00')).toBe('8:14 AM');
    expect(displayTime('8:00')).toBe('8:00 AM');
  });
});

describe('setDefaultTimeZone()', () => {
  beforeEach(() => {
    setDefaultTimeZone('America/New_York');
  });

  it('sets default time zone', () => {
    setDefaultTimeZone('America/Los_Angeles');
    expect(dateTimeStrings(new Date(893277340752))).toEqual({
      date: '1998-04-22',
      time: '13:35:40',
    });
  });
});
