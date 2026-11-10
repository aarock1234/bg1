import { DateTime, ParkTime } from '@/datetime';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const MS_PER_SECOND = 1000;

function secondsOfDay(time: ParkTime): number {
  return (
    time.hour * SECONDS_PER_HOUR +
    time.minute * SECONDS_PER_MINUTE +
    time.second
  );
}

// Makes the app believe it is `time` at the resort right now. The clock keeps
// running from there. Only `Date.now` is shifted, which is where the app gets
// the current time from.
export function pinParkTime(time: ParkTime): void {
  const realNow = Date.now.bind(Date);
  const currentTime = DateTime.from(realNow()).time;
  const offsetMs =
    (secondsOfDay(time) - secondsOfDay(currentTime)) * MS_PER_SECOND;

  Date.now = () => realNow() + offsetMs;
}

// Returns the park time `minutes` from now, on a five-minute mark like the
// return times Disney offers.
export function minutesFromNow(minutes: number): ParkTime {
  const time = DateTime.now().time.add({
    minutes,
  });

  return time.with({
    minute: time.minute - (time.minute % 5),
    second: 0,
  });
}
