import { use } from 'react';

import { FlexExperience } from '@/api/ll';
import Button from '@/components/Button';
import { Time } from '@/components/Time';
import NavContext from '@/contexts/NavContext';
import ChevronRightIcon from '@/icons/ChevronRightIcon';

import BookExperience from '../BookExperience';

type LLButtonProps = {
  experience: FlexExperience;
};

// Opens the booking screen. Its label is the next return time, which is muted
// when there is none to book right now.
export default function LLButton({ experience }: LLButtonProps) {
  const { goTo } = use(NavContext);
  const hasReturnTime = !!experience.flex.nextAvailableTime;

  function showBookingScreen() {
    goTo(<BookExperience experience={experience} />);
  }

  return (
    <Button
      onClick={showBookingScreen}
      className={`min-w-28 justify-between pr-2 tabular-nums ${hasReturnTime ? '' : 'text-muted'}`}
    >
      <NextReturnTime experience={experience} />
      <ChevronRightIcon className="w-4 text-muted" />
    </Button>
  );
}

function NextReturnTime({ experience }: LLButtonProps) {
  const { flex, standby } = experience;

  if (standby.unavailableReason === 'CLOSED') {
    return 'Book';
  }

  if (!flex.nextAvailableTime) {
    return 'none';
  }

  return <Time time={flex.nextAvailableTime} />;
}
