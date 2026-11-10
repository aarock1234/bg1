import { use, useCallback, useEffect, useState } from 'react';

import { authStore } from '@/api/auth';
import { Queue } from '@/api/vq';
import Button from '@/components/Button';
import Screen from '@/components/Screen';
import RefreshButton from '@/components/ll/screens/RefreshButton';
import ClientsContext from '@/contexts/ClientsContext';
import useDataLoader from '@/hooks/useDataLoader';
import ExitIcon from '@/icons/ExitIcon';
import onVisible from '@/onVisible';

import QueueListing from './QueueListing';

function isAttraction(queue: Queue): boolean {
  return queue.categoryContentId === 'attraction';
}

function isActive(queue: Queue): boolean {
  return queue.isAcceptingPartyCreation || queue.isAcceptingJoins;
}

// Orders active queues first, and attractions before other kinds of queue.
function compareQueues(a: Queue, b: Queue): number {
  return (
    Number(isActive(b)) - Number(isActive(a)) ||
    Number(isAttraction(b)) - Number(isAttraction(a))
  );
}

export default function SelectQueue() {
  const { vq } = use(ClientsContext);
  const { loadData, loaderElem } = useDataLoader();
  const [queues, setQueues] = useState<Queue[]>();

  const refreshQueues = useCallback(() => {
    loadData(async () => {
      const currentQueues = await vq.getQueues();

      setQueues([...currentQueues].sort(compareQueues));
    });
  }, [vq, loadData]);

  useEffect(() => {
    refreshQueues();

    return onVisible(refreshQueues);
  }, [refreshQueues]);

  return (
    <Screen
      title="Virtual Queues"
      buttons={<RefreshButton name="Queues" onClick={refreshQueues} />}
    >
      {queues && <QueueList queues={queues} isLoaderShown={!!loaderElem} />}
      <LogOutButton />
      {loaderElem}
    </Screen>
  );
}

// Logging out is rarely wanted, so it sits quietly below the queues.
function LogOutButton() {
  return (
    <div className="mt-6 flex justify-center">
      <Button
        variant="quiet"
        className="text-muted"
        onClick={() => authStore.deleteData()}
      >
        <ExitIcon className="w-4" />
        Log Out
      </Button>
    </div>
  );
}

type QueueListProps = {
  queues: Queue[];
  isLoaderShown: boolean;
};

function QueueList({ queues, isLoaderShown }: QueueListProps) {
  if (queues.length > 0) {
    return (
      <ul className="list mt-4">
        {queues.map(queue => (
          <li className="px-3.5 py-3" key={queue.id}>
            <QueueListing queue={queue} />
          </li>
        ))}
      </ul>
    );
  }

  // The message stays hidden while the spinner or a flash message is shown.
  if (isLoaderShown) {
    return null;
  }

  return <p className="empty-state">No virtual queues found</p>;
}
