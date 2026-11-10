import { use } from 'react';

import { FlexExperience } from '@/api/ll';
import Button from '@/components/Button';
import { Time } from '@/components/Time';
import NavContext from '@/contexts/NavContext';
import { ParkTime } from '@/datetime';
import ChevronRightIcon from '@/icons/ChevronRightIcon';

import BookExperience from '../BookExperience';
import { returnTimeTone, timeUntil } from './time-until';

type LLButtonProps = {
  experience: FlexExperience;

  // The time now, when the list is for today. A return time is then shown
  // with how far away it is.
  now?: ParkTime;
};

type NextReturnTimeProps = LLButtonProps;

// Opens the booking screen. Its label is the next return time, which is muted
// when there is none to book right now.
export default function LLButton({ experience, now }: LLButtonProps) {
  const { goTo } = use(NavContext);
  const hasReturnTime = !!experience.flex.nextAvailableTime;

  function showBookingScreen() {
    goTo(<BookExperience experience={experience} />);
  }

  return (
    <Button
      onClick={showBookingScreen}
      className={`h-auto min-h-11 min-w-26 justify-between gap-1 py-1 pr-1.5 pl-3 tabular-nums ${hasReturnTime ? '' : 'text-muted'}`}
    >
      <NextReturnTime experience={experience} now={now} />
      <ChevronRightIcon className="w-4 shrink-0 text-muted" />
    </Button>
  );
}

function NextReturnTime({ experience, now }: NextReturnTimeProps) {
  const { flex, standby } = experience;
  const time = flex.nextAvailableTime;

  if (standby.unavailableReason === 'CLOSED') {
    return 'Book';
  }

  if (!time) {
    return 'none';
  }

  if (!now) {
    return <Time time={time} />;
  }

  return (
    <span className="flex flex-col items-start leading-tight">
      <Time time={time} />
      <span className={`text-[11px] font-medium ${returnTimeTone(time, now)}`}>
        {timeUntil(time, now)}
      </span>
    </span>
  );
}
