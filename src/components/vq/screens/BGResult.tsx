import { use, useEffect, useState } from 'react';

import { Guest, JoinQueueConflicts, JoinQueueResult, Queue } from '@/api/vq';
import FloatingButton from '@/components/FloatingButton';
import GuestList from '@/components/GuestList';
import NavContext from '@/contexts/NavContext';
import AlertIcon from '@/icons/AlertIcon';

import QueueScreen from './QueueScreen';
import SelectQueue from './SelectQueue';

// How long the Done button stays hidden after the boarding group is shown.
const DONE_BTN_HIDDEN_MS = 5_000;

type BGResultProps = {
  queue: Queue;
  guests: Guest[];
  result: JoinQueueResult;
};

export default function BGResult({ queue, guests, result }: BGResultProps) {
  const { boardingGroup, conflicts } = result;
  const joinedGuests = guests.filter(guest => !(guest.id in conflicts));
  const failedGuests = guests.filter(guest => guest.id in conflicts);

  return (
    <QueueScreen queue={queue} title="Boarding Group">
      {boardingGroup !== null ? (
        <BoardingGroupObtained
          boardingGroup={boardingGroup}
          joinedGuests={joinedGuests}
          failedGuests={failedGuests}
          conflicts={conflicts}
        />
      ) : (
        <NoBoardingGroup failedGuests={failedGuests} conflicts={conflicts} />
      )}
    </QueueScreen>
  );
}

type NoBoardingGroupProps = {
  failedGuests: Guest[];
  conflicts: JoinQueueConflicts;
};

function NoBoardingGroup({ failedGuests, conflicts }: NoBoardingGroupProps) {
  return (
    <>
      <div className="card mt-4">
        <AlertIcon className="w-6 text-danger" />
        <h3 className="mt-3">Sorry!</h3>
        <p className="note mb-0">
          A boarding group could not be obtained. Go back and try again.
        </p>
      </div>
      <GuestList guests={failedGuests} conflicts={conflicts} />
    </>
  );
}

type BoardingGroupObtainedProps = {
  boardingGroup: number;
  joinedGuests: Guest[];
  failedGuests: Guest[];
  conflicts: JoinQueueConflicts;
};

function BoardingGroupObtained({
  boardingGroup,
  joinedGuests,
  failedGuests,
  conflicts,
}: BoardingGroupObtainedProps) {
  const { goBack } = use(NavContext);
  const [isDoneShown, setIsDoneShown] = useState(false);
  const hasConflicts = Object.keys(conflicts).length > 0;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsDoneShown(true);
    }, DONE_BTN_HIDDEN_MS);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <div className="card mt-4 py-6 text-center">
        <h3 className="mt-0">Congratulations! 🎉</h3>
        <p className="note mt-1">You joined the virtual queue!</p>
        <p className="mt-4 mb-0 text-[28px] leading-tight font-semibold tracking-tight tabular-nums">
          Boarding Group: {boardingGroup}
        </p>
      </div>
      <GuestList guests={joinedGuests} />

      {hasConflicts && (
        <>
          <p className="section-title">These guests could not join:</p>
          <GuestList guests={failedGuests} conflicts={conflicts} />
        </>
      )}

      <p className="note mt-4 px-1">
        Refer to the My Disney Experience app for return time and other
        information.
      </p>
      {isDoneShown && (
        <FloatingButton
          onClick={() => {
            return goBack({
              screen: SelectQueue,
            });
          }}
        >
          Done
        </FloatingButton>
      )}
    </>
  );
}
