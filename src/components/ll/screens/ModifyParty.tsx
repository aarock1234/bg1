import { use, useState } from 'react';

import FloatingButton from '@/components/FloatingButton';
import GuestList, { Guest } from '@/components/GuestList';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import PartyContext, { Party } from '@/contexts/PartyContext';

import IneligibleGuestList from '../IneligibleGuestList';

type ModifyPartyProps = {
  party: Party;
};

// Lets the guest choose which eligible guests to book for. The choice only
// takes effect when it is confirmed.
export default function ModifyParty({ party }: ModifyPartyProps) {
  const { eligible, ineligible, selected, experience } = party;
  const { maxPartySize } = use(ClientsContext).ll.rules;
  const [newParty, setNewParty] = useState(() => new Set<Guest>(selected));

  function toggleGuest(guest: Guest) {
    const toggledParty = new Set(newParty);

    if (toggledParty.has(guest)) {
      toggledParty.delete(guest);
    } else {
      toggledParty.add(guest);
    }

    setNewParty(toggledParty);
  }

  function confirmParty() {
    party.setSelected(eligible.filter(guest => newParty.has(guest)));
  }

  return (
    <PartyContext value={party}>
      <Screen title="Modify Party" theme={experience.park.theme}>
        <h2 className="mt-5">{experience.name}</h2>
        <div className="mt-0.5 text-[15px] text-muted">
          {experience.park.name}
        </div>
        <h3>Your Party</h3>
        <GuestList
          guests={eligible}
          selectable={{
            isSelected: guest => newParty.has(guest),
            onToggle: toggleGuest,
            limit: maxPartySize,
          }}
        />
        {ineligible.length > 0 && (
          <>
            <h3>Ineligible Guests</h3>
            <IneligibleGuestList />
          </>
        )}
        <FloatingButton
          back
          disabled={newParty.size === 0}
          onClick={confirmParty}
        >
          Confirm Party
        </FloatingButton>
      </Screen>
    </PartyContext>
  );
}
