import { use, useEffect, useState } from 'react';

import { Guest, JoinQueueConflicts, JoinQueueResult, Queue } from '@/api/vq';
import FloatingButton from '@/components/FloatingButton';
import GuestList from '@/components/GuestList';
import NavContext from '@/contexts/NavContext';

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
        <>
          <h3>Sorry!</h3>
          <p>A boarding group could not be obtained. Go back and try again.</p>
          <GuestList guests={failedGuests} conflicts={conflicts} />
        </>
      )}
    </QueueScreen>
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
      <h3>Congratulations! 🎉</h3>
      <p>You joined the virtual queue!</p>
      <p className="text-lg font-semibold">Boarding Group: {boardingGroup}</p>
      <GuestList guests={joinedGuests} />

      {hasConflicts && (
        <>
          <p className="font-semibold">These guests could not join:</p>
          <GuestList guests={failedGuests} conflicts={conflicts} />
        </>
      )}

      <p>
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
