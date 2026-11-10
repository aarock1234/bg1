import { use, useEffect, useState } from 'react';

import { Guest, Queue } from '@/api/vq';
import FloatingButton from '@/components/FloatingButton';
import GuestList from '@/components/GuestList';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import useDataLoader from '@/hooks/useDataLoader';

import JoinQueue from './JoinQueue';
import QueueScreen from './QueueScreen';

type ChoosePartyProps = {
  queue: Queue;
};

export default function ChooseParty({ queue }: ChoosePartyProps) {
  const { goTo } = use(NavContext);
  const { vq } = use(ClientsContext);
  const { loadData, loaderElem } = useDataLoader();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [party, setParty] = useState<Set<Guest>>(new Set());

  useEffect(() => {
    loadData(async () => {
      const linkedGuests = await vq.getLinkedGuests(queue);
      const preselectedGuests = linkedGuests.filter(guest => guest.preselected);

      setGuests(linkedGuests);
      setParty(new Set(preselectedGuests));
    });
  }, [queue, vq, loadData]);

  function toggleGuest(guest: Guest) {
    const updatedParty = new Set(party);

    if (updatedParty.has(guest)) {
      updatedParty.delete(guest);
    } else {
      updatedParty.add(guest);
    }

    setParty(updatedParty);
  }

  return (
    <QueueScreen queue={queue} title="Choose Your Party">
      <p>
        Select everyone in your party who would like to experience this
        attraction, and tap the <b>Confirm Party</b> button.
      </p>
      <h3>Your Party</h3>
      {guests.length > 0 ? (
        <GuestList
          guests={guests}
          selectable={{
            isSelected: guest => party.has(guest),
            onToggle: toggleGuest,
            limit: queue.maxPartySize,
          }}
        />
      ) : (
        <p>No guests available</p>
      )}
      <FloatingButton
        disabled={party.size === 0}
        onClick={() => goTo(<JoinQueue queue={queue} guests={[...party]} />)}
      >
        Confirm Party
      </FloatingButton>
      {loaderElem}
    </QueueScreen>
  );
}
