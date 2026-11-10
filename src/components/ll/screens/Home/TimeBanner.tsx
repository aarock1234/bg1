import { Time } from '@/components/Time';
import { DateTime, ParkTime } from '@/datetime';

type TimeBannerProps = {
  bookTime?: ParkTime;
  dropTime?: ParkTime;
};

// A line of upcoming times: when the party can next book, and when the park
// next releases more Lightning Lane availability.
export default function TimeBanner({ bookTime, dropTime }: TimeBannerProps) {
  if (!bookTime && !dropTime) {
    return null;
  }

  return (
    <div className="flex gap-x-5 px-1">
      <LabeledTime label="Book" time={bookTime} />
      <LabeledTime label="Drop" time={dropTime} />
    </div>
  );
}

type LabeledTimeProps = {
  label?: string;
  time?: ParkTime;
};

function LabeledTime({ label, time }: LabeledTimeProps) {
  if (!time) {
    return null;
  }

  const currentMinute = DateTime.now().time.with({
    second: 0,
  });
  const isUpcoming = time > currentMinute;

  return (
    <div>
      {label}:{' '}
      {isUpcoming ? (
        <Time time={time} className="font-medium text-ink" />
      ) : (
        <time dateTime={`${time}`} className="font-medium text-ink">
          now
        </time>
      )}
    </div>
  );
}
