import { useEffect, useState } from 'react';

import { DateTime } from '@/datetime';
import { now, syncTime } from '@/timesync';

const CLOCK_UPDATE_MS = 50;

type ClockProps = {
  onSync: (synced: boolean) => void;
};

export default function Clock({ onSync }: ClockProps) {
  const [time, setTime] = useState(now());

  useEffect(() => {
    const intervalId = setInterval(() => setTime(now()), CLOCK_UPDATE_MS);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    syncTime()
      .then(() => onSync(true))
      .catch(() => onSync(false));
  }, [onSync]);

  return <time>{DateTime.from(time).time.toString()}</time>;
}
