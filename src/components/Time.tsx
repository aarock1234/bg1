import { ParkTime, formatTime } from '@/datetime';

// The longest time string that is only an hour, such as "8" or "15".
const HOUR_ONLY_MAX_LENGTH = 2;

type TimeProps = React.HTMLProps<HTMLTimeElement> & {
  time: ParkTime | string;
};

// An hour on its own isn't a valid machine-readable time, so it gets minutes.
function dateTimeAttribute(time: string): string {
  const isHourOnly = time.length <= HOUR_ONLY_MAX_LENGTH;

  return isHourOnly ? `${time}:00` : time;
}

// Shows a time on a 12-hour clock. Anything that isn't a valid time is shown
// as it is.
export function Time({ time, ...attrs }: TimeProps) {
  const timeString = time.toString();
  let formattedTime: string;

  try {
    formattedTime = formatTime(timeString);
  } catch (error) {
    console.error(error);

    return timeString;
  }

  const [hourAndMinutes, period] = formattedTime.split(' ');

  return (
    <time {...attrs} dateTime={dateTimeAttribute(timeString)}>
      <span className="whitespace-nowrap">
        {hourAndMinutes} <span className="text-[0.8em]">{period}</span>
      </span>
    </time>
  );
}
