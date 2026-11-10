import { use, useCallback, useEffect, useState } from 'react';

import { authStore } from '@/api/auth';
import { Queue } from '@/api/vq';
import Button from '@/components/Button';
import Screen from '@/components/Screen';
import RefreshButton from '@/components/ll/screens/RefreshButton';
import ClientsContext from '@/contexts/ClientsContext';
import ThemeContext from '@/contexts/ThemeContext';
import useDataLoader from '@/hooks/useDataLoader';
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
  const theme = use(ThemeContext);
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
      footer={
        <div className="p-2 text-right">
          <Button
            color={`bg-white/90 ${theme.text}`}
            onClick={() => authStore.deleteData()}
          >
            Log Out
          </Button>
        </div>
      }
    >
      {queues && <QueueList queues={queues} isLoaderShown={!!loaderElem} />}
      {loaderElem}
    </Screen>
  );
}

type QueueListProps = {
  queues: Queue[];
  isLoaderShown: boolean;
};

function QueueList({ queues, isLoaderShown }: QueueListProps) {
  if (queues.length > 0) {
    return (
      <ul className="dividers mt-1">
        {queues.map(queue => (
          <li key={queue.id}>
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

  return (
    <p className="text-gray-500 font-semibold text-center uppercase">
      No virtual queues found
    </p>
  );
}
