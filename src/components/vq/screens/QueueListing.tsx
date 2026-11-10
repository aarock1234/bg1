import { use } from 'react';

import { Queue } from '@/api/vq';
import Button from '@/components/Button';
import { Time } from '@/components/Time';
import NavContext from '@/contexts/NavContext';

import ChooseParty from './ChooseParty';

function isActive(queue: Queue): boolean {
  return queue.isAcceptingPartyCreation || queue.isAcceptingJoins;
}

type QueueListingProps = {
  queue: Queue;
};

export default function QueueListing({ queue }: QueueListingProps) {
  const { goTo } = use(NavContext);

  return (
    <>
      <h2 className="mt-0">{queue.name}</h2>
      <div className="flex items-center mt-2">
        <div className="flex-1">
          <Availability queue={queue} />
        </div>
        <div className="pl-3">
          <Button
            disabled={!isActive(queue)}
            onClick={() => goTo(<ChooseParty queue={queue} />)}
          >
            {isActive(queue) ? 'Join Queue' : 'Closed'}
          </Button>
        </div>
      </div>
    </>
  );
}

function Availability({ queue }: QueueListingProps) {
  if (queue.isAcceptingJoins) {
    return <span>Available now</span>;
  }

  if (!queue.nextScheduledOpenTime) {
    return 'Check Disney app for opening times';
  }

  return (
    <>
      Next opening:{' '}
      <Time time={queue.nextScheduledOpenTime} className="font-semibold" />
    </>
  );
}
