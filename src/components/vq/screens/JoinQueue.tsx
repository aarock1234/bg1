import { use } from 'react';

import { Resort } from '@/api/resort';
import { Guest, Queue } from '@/api/vq';
import FloatingButton from '@/components/FloatingButton';
import GuestList from '@/components/GuestList';
import TimeBoard from '@/components/TimeBoard';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import ResortContext from '@/contexts/ResortContext';
import useDataLoader from '@/hooks/useDataLoader';
import { ping } from '@/ping';

import BGResult from './BGResult';
import QueueScreen from './QueueScreen';

// A join attempt keeps the spinner up for about a second, longer than other
// loads.
const JOIN_MIN_LOAD_TIME_MS = 999;

// Usage reporting is best-effort: a failure must not get in the guest's way.
async function reportJoinedQueue(resort: Resort): Promise<void> {
  try {
    await ping(resort, 'V');
  } catch (error) {
    console.error(error);
  }
}

type JoinQueueProps = {
  queue: Queue;
  guests: Guest[];
};

export default function JoinQueue({ queue, guests }: JoinQueueProps) {
  const { goTo } = use(NavContext);
  const resort = use(ResortContext);
  const { vq } = use(ClientsContext);
  const { loadData, loaderElem } = useDataLoader();

  async function joinQueue() {
    const result = await loadData(
      async flash => {
        const currentQueue = await vq.getQueue(queue);

        if (!currentQueue.isAcceptingJoins) {
          flash(
            currentQueue.isAcceptingPartyCreation
              ? 'Queue not open yet'
              : 'No boarding groups available'
          );

          return undefined;
        }

        return vq.joinQueue(queue, guests);
      },
      {
        minLoadTimeMs: JOIN_MIN_LOAD_TIME_MS,
      }
    );

    if (!result) {
      return;
    }

    goTo(<BGResult queue={queue} guests={guests} result={result} />, {
      replace: true,
    });

    if (result.boardingGroup !== null) {
      await reportJoinedQueue(resort);
    }
  }

  return (
    <QueueScreen queue={queue} title="Virtual Queue">
      <QueueOpening queue={queue} />
      <h3>Your Party</h3>
      <GuestList guests={guests} />
      <FloatingButton onClick={joinQueue}>Join Virtual Queue</FloatingButton>
      {loaderElem}
    </QueueScreen>
  );
}

type QueueOpeningProps = {
  queue: Queue;
};

// Tells the guest when to tap the Join button.
function QueueOpening({ queue }: QueueOpeningProps) {
  if (queue.isAcceptingJoins) {
    return <p>The virtual queue is open. Join now!</p>;
  }

  if (!queue.nextScheduledOpenTime) {
    return null;
  }

  return (
    <>
      <TimeBoard
        time={queue.nextScheduledOpenTime}
        label="Next queue opening"
      />
      <p>
        Tap the <b>Join Virtual Queue</b> button when the clock reads{' '}
        <time className="font-semibold">{queue.nextScheduledOpenTime}</time>.
        The queue can fill up almost instantly, so be quick!
      </p>
    </>
  );
}
