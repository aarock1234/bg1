import { use } from 'react';

import { Time } from '@/components/Time';
import ThemeContext from '@/contexts/ThemeContext';
import { DateTime, ParkTime } from '@/datetime';

type TimeBannerProps = {
  bookTime?: ParkTime;
  dropTime?: ParkTime;
};

export default function TimeBanner({ bookTime, dropTime }: TimeBannerProps) {
  const theme = use(ThemeContext);

  if (!bookTime && !dropTime) {
    return null;
  }

  return (
    <div className={`flex justify-center gap-x-10 ${theme.bg}`}>
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
        <Time time={time} />
      ) : (
        <time dateTime={`${time}`}>now</time>
      )}
    </div>
  );
}
