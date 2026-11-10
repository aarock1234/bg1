import { use } from 'react';

import Alert from '@/components/Alert';
import { Time } from '@/components/Time';
import ClientsContext from '@/contexts/ClientsContext';
import RebookingContext from '@/contexts/RebookingContext';
import { DateTime } from '@/datetime';

import IneligibleGuestList from '../../IneligibleGuestList';

// Tells the party when it can next book, if that time is still ahead.
function EligibleTimeAlert() {
  const { nextBookTime } = use(ClientsContext).ll;
  const now = DateTime.now().time.with({
    second: 0,
  });

  if (!nextBookTime || nextBookTime <= now) {
    return null;
  }

  return (
    <Alert
      title={
        <>
          Eligible at <Time time={nextBookTime} />
        </>
      }
    />
  );
}

function UnableToModify() {
  return (
    <>
      <h3>Unable to Modify</h3>
      <p>
        Your current reservation cannot be modified to this experience due to
        the following conflicts:
      </p>
    </>
  );
}

function NotEligibleYet() {
  return (
    <>
      <EligibleTimeAlert />
      <h3>No Eligible Guests</h3>
      <p>No one in your party is currently eligible for this Lightning Lane.</p>
    </>
  );
}

export default function NoEligibleGuests() {
  const rebooking = use(RebookingContext);

  return (
    <>
      {rebooking.current ? <UnableToModify /> : <NotEligibleYet />}
      <IneligibleGuestList />
    </>
  );
}
