import { Booking } from '@/api/itinerary';
import { parkDate } from '@/datetime';

import { Day } from '../Day';
import { Time } from '../Time';

type ReturnWindowProps = Pick<Booking, 'start' | 'end'>;

type WindowEndProps = {
  start: ReturnWindowProps['start'];
  end: NonNullable<ReturnWindowProps['end']>;
};

// Shows when a return window ends: the date when it ends on a later park day,
// otherwise the time.
function WindowEnd({ start, end }: WindowEndProps) {
  const endParkDate = parkDate(end);

  if (endParkDate > parkDate(start)) {
    return <Day type="short">{endParkDate}</Day>;
  }

  if (end.time) {
    return <Time time={end.time} />;
  }

  return <span>Park Close</span>;
}

export default function ReturnWindow({ start, end }: ReturnWindowProps) {
  return (
    <span className="whitespace-nowrap">
      {start.time ? <Time time={start.time} /> : <span>Park Open</span>}
      {end && (
        <>
          {' – '}
          <WindowEnd start={start} end={end} />
        </>
      )}
    </span>
  );
}
