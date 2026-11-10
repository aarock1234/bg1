import { use, useEffect, useState } from 'react';

import { Guest } from '@/api/ll';
import FloatingButton from '@/components/FloatingButton';
import GuestList from '@/components/GuestList';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import useDataLoader from '@/hooks/useDataLoader';
import useSavedParty from '@/hooks/useSavedParty';

// Orders the primary guest first, then everyone else by name.
function comparePrimaryThenName(a: Guest, b: Guest): number {
  const byPrimary = Number(!a.primary) - Number(!b.primary);

  return byPrimary || a.name.localeCompare(b.name);
}

type ModeProps = {
  selected: boolean;
  onChange: () => void;
  children: string;
};

function Mode({ selected, onChange, children }: ModeProps) {
  return (
    <li>
      <label className="flex items-center mt-2">
        <input
          type="radio"
          name="auto"
          onChange={onChange}
          checked={selected}
          className="mr-2"
        />{' '}
        {children}
      </label>
    </li>
  );
}

type PartyGuestsProps = {
  // Undefined until the guests have loaded.
  guests: Guest[] | undefined;
  partyIds: Set<string>;
  onPartyIdsChange: (partyIds: Set<string>) => void;
};

function PartyGuests({ guests, partyIds, onPartyIdsChange }: PartyGuestsProps) {
  if (!guests) {
    return null;
  }

  if (guests.length === 0) {
    return <p className="text-red-d">No guests to select</p>;
  }

  const partyGuests = guests.filter(guest => partyIds.has(guest.id));
  const nonpartyGuests = guests.filter(guest => !partyIds.has(guest.id));

  function removeFromParty(guest: Guest) {
    const newPartyIds = new Set(partyIds);
    newPartyIds.delete(guest.id);
    onPartyIdsChange(newPartyIds);
  }

  function addToParty(guest: Guest) {
    onPartyIdsChange(new Set(partyIds).add(guest.id));
  }

  return (
    <>
      {partyGuests.length > 0 && (
        <>
          <h3>Your Party</h3>
          <GuestList
            guests={partyGuests}
            selectable={{
              isSelected: () => true,
              onToggle: removeFromParty,
            }}
          />
        </>
      )}
      {nonpartyGuests.length > 0 && (
        <>
          <h3>Add to Your Party</h3>
          <GuestList
            guests={nonpartyGuests}
            selectable={{
              isSelected: () => false,
              onToggle: addToParty,
            }}
          />
        </>
      )}
    </>
  );
}

// Lets the guest choose between booking for every eligible guest and booking
// only for a saved party. An empty saved party means everyone.
export default function PartySelector() {
  const { ll } = use(ClientsContext);
  const { loadData, loaderElem } = useDataLoader();
  const [guests, setGuests] = useState<Guest[]>();
  const [savedPartyIds, savePartyIds] = useSavedParty();
  const [partyIds, setPartyIds] = useState(savedPartyIds);
  const [isAuto, setIsAuto] = useState(partyIds.size === 0);

  useEffect(() => {
    loadData(async () => {
      const { eligible, ineligible } = await ll.guests();
      const allGuests = [...eligible, ...ineligible];

      setGuests(allGuests.sort(comparePrimaryThenName));
    });
  }, [ll, loadData]);

  function bookForAllGuests() {
    setIsAuto(true);
    setPartyIds(new Set());
  }

  function bookForSelectedGuests() {
    setIsAuto(false);
  }

  return (
    <Screen title="Party Selection">
      <p>
        By default, all eligible guests (up to a maximum of 12) are
        automatically selected when you book a Lightning Lane. If you would like
        to limit who you book for, you can manually select your party here.
      </p>
      <ul>
        <Mode selected={isAuto} onChange={bookForAllGuests}>
          Book for all eligible guests
        </Mode>
        <Mode selected={!isAuto} onChange={bookForSelectedGuests}>
          Only book for selected guests
        </Mode>
      </ul>

      {!isAuto && (
        <PartyGuests
          guests={guests}
          partyIds={partyIds}
          onPartyIdsChange={setPartyIds}
        />
      )}
      {loaderElem}
      <FloatingButton
        back
        disabled={!isAuto && partyIds.size === 0}
        onClick={() => savePartyIds(partyIds)}
      >
        Save
      </FloatingButton>
    </Screen>
  );
}
