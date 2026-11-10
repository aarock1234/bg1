import { use } from 'react';

import { Queue } from '@/api/vq';
import Button from '@/components/Button';
import { Time } from '@/components/Time';
import NavContext from '@/contexts/NavContext';
import ChevronRightIcon from '@/icons/ChevronRightIcon';

import ChooseParty from './ChooseParty';

function isActive(queue: Queue): boolean {
  return queue.isAcceptingPartyCreation || queue.isAcceptingJoins;
}

type QueueListingProps = {
  queue: Queue;
};

// One queue in the list: its name, then when it opens next to the button that
// starts joining it.
export default function QueueListing({ queue }: QueueListingProps) {
  return (
    <>
      <h2 className="mt-0 text-base font-medium">{queue.name}</h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 text-sm text-muted">
          <Availability queue={queue} />
        </div>
        <JoinButton queue={queue} />
      </div>
    </>
  );
}

function JoinButton({ queue }: QueueListingProps) {
  const { goTo } = use(NavContext);

  if (!isActive(queue)) {
    return <Button disabled>Closed</Button>;
  }

  return (
    <Button
      className="pr-2"
      onClick={() => goTo(<ChooseParty queue={queue} />)}
    >
      Join Queue
      <ChevronRightIcon className="w-4 text-muted" />
    </Button>
  );
}

function Availability({ queue }: QueueListingProps) {
  if (queue.isAcceptingJoins) {
    return <span className="badge badge-solid">Available now</span>;
  }

  if (!queue.nextScheduledOpenTime) {
    return 'Check Disney app for opening times';
  }

  return (
    <>
      Next opening:{' '}
      <Time
        time={queue.nextScheduledOpenTime}
        className="text-[15px] font-medium text-ink"
      />
    </>
  );
}
