import { use } from 'react';

import { FlexExperience } from '@/api/ll';
import Button from '@/components/Button';
import { Time } from '@/components/Time';
import NavContext from '@/contexts/NavContext';

import BookExperience from '../BookExperience';

type LLButtonProps = {
  experience: FlexExperience;
};

export default function LLButton({ experience }: LLButtonProps) {
  const { goTo } = use(NavContext);

  function showBookingScreen() {
    goTo(<BookExperience experience={experience} />);
  }

  return (
    <Button onClick={showBookingScreen}>
      <NextReturnTime experience={experience} />
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
