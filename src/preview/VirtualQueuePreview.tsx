import { JSX, use, useCallback } from 'react';

import { Guest, Queue } from '@/api/vq';
import BGClient from '@/components/vq/BGClient';
import BGResult from '@/components/vq/screens/BGResult';
import ChooseParty from '@/components/vq/screens/ChooseParty';
import JoinQueue from '@/components/vq/screens/JoinQueue';
import SelectQueue from '@/components/vq/screens/SelectQueue';
import ClientsContext from '@/contexts/ClientsContext';
import NavProvider from '@/providers/NavProvider';

import DeepLink from './DeepLink';
import { GUEST_NOT_IN_PARK_ID } from './data/queues';
import { PreviewOptions } from './options';

type QueueScreenBuilder = (queue: Queue, guests: Guest[]) => JSX.Element;

// The virtual queue screens that can be opened directly with `screen=<name>`.
const VQ_SCREENS: Record<string, QueueScreenBuilder> = {
  party(queue) {
    return <ChooseParty queue={queue} />;
  },

  join(queue, guests) {
    return <JoinQueue queue={queue} guests={guests.slice(0, 2)} />;
  },

  result(queue, guests) {
    return (
      <BGResult
        queue={queue}
        guests={guests}
        result={{
          boardingGroup: 42,
          conflicts: {
            [GUEST_NOT_IN_PARK_ID]: 'NOT_IN_PARK',
          },
          closed: false,
        }}
      />
    );
  },

  'no-result'(queue, guests) {
    return (
      <BGResult
        queue={queue}
        guests={guests}
        result={{
          boardingGroup: null,
          conflicts: {
            [GUEST_NOT_IN_PARK_ID]: 'NOT_IN_PARK',
          },
          closed: true,
        }}
      />
    );
  },
};

type VirtualQueuePreviewProps = {
  options: PreviewOptions;
};

// Shows the virtual queue app, with one of its screens opened on top of the
// queue list when the options name one. The `id` option picks the queue.
export default function VirtualQueuePreview({
  options,
}: VirtualQueuePreviewProps) {
  const { vq } = use(ClientsContext);
  const { screen, id } = options;
  const buildScreen = screen ? VQ_SCREENS[screen] : undefined;

  const open = useCallback(async () => {
    if (!buildScreen) {
      throw new Error('no screen to open');
    }

    const queues = await vq.getQueues();
    const queue = queues.find(queue => queue.id === id) ?? queues[0];

    if (!queue) {
      throw new Error('there are no queues in this scenario');
    }

    return buildScreen(queue, await vq.getLinkedGuests(queue));
  }, [buildScreen, vq, id]);

  if (!buildScreen) {
    return <BGClient />;
  }

  return (
    <NavProvider>
      <DeepLink open={open}>
        <SelectQueue />
      </DeepLink>
    </NavProvider>
  );
}
