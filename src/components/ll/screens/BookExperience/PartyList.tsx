import { use } from 'react';

import Alert from '@/components/Alert';
import Button from '@/components/Button';
import GuestList from '@/components/GuestList';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import PartyContext from '@/contexts/PartyContext';

import IneligibleGuestList from '../../IneligibleGuestList';
import ModifyParty from '../ModifyParty';

function PartySizeAlert() {
  return (
    <Alert title="Party Size Restricted">
      <p>
        Lightning Lane reservations are limited to 20 guests. If everyone in
        your party wishes to experience this attraction, you will need to book
        multiple reservations.
      </p>
    </Alert>
  );
}

function SelectedGuests() {
  const { goTo } = use(NavContext);
  const party = use(PartyContext);

  return (
    <>
      <div className="mt-4">
        <h3 className="inline mt-0">Your Party</h3>
        <Button
          type="small"
          onClick={() => goTo(<ModifyParty party={party} />)}
          className="ml-3"
        >
          Modify Party
        </Button>
      </div>
      <GuestList guests={party.selected} />
    </>
  );
}

function IneligibleGuests() {
  return (
    <>
      <h3>Ineligible Guests</h3>
      <IneligibleGuestList />
    </>
  );
}

// Lists who the Lightning Lane will be booked for.
export default function PartyList() {
  const { eligible, selected } = use(PartyContext);
  const { maxPartySize } = use(ClientsContext).ll.rules;
  const isPartySizeRestricted =
    eligible.length > maxPartySize && selected.length === maxPartySize;

  return (
    <>
      {isPartySizeRestricted && <PartySizeAlert />}
      {selected.length > 0 ? <SelectedGuests /> : <IneligibleGuests />}
    </>
  );
}
