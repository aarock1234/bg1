import { use, useState } from 'react';

import { DasBooking, LightningLane } from '@/api/itinerary';
import FloatingButton from '@/components/FloatingButton';
import GuestList from '@/components/GuestList';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import PlansContext from '@/contexts/PlansContext';
import useDataLoader from '@/hooks/useDataLoader';

import ReturnTime from '../ReturnTime';

type CancellableBooking = LightningLane | DasBooking;

type BookingGuest = CancellableBooking['guests'][number];

type CancelGuestsProps<B extends CancellableBooking> = {
  booking: B;

  // Called with the guests who are still on the booking.
  onCancel: (newGuests: B['guests']) => void;

  // The guest a DAS booking depends on. It can't be kept without them, so
  // cancelling this guest cancels everyone.
  dasGuest?: B['guests'][number];
};

export default function CancelGuests<B extends CancellableBooking>({
  booking,
  onCancel,
  dasGuest,
}: CancelGuestsProps<B>) {
  const { goBack } = use(NavContext);
  const { ll, das } = use(ClientsContext);
  const { refreshPlans } = use(PlansContext);
  const { loadData, loaderElem } = useDataLoader();
  const [guestsToCancel, setGuestsToCancel] = useState(new Set<BookingGuest>());

  const { name, park, guests } = booking;
  const client = booking.type === 'DAS' ? das : ll;
  const isCancelingNone = guestsToCancel.size === 0;
  const isCancelingAll = guestsToCancel.size === guests.length;

  function toggleAllGuests() {
    setGuestsToCancel(new Set(isCancelingAll ? [] : guests));
  }

  function cancelGuest(guest: BookingGuest) {
    const isDasGuest = guest === dasGuest;

    setGuestsToCancel(new Set(isDasGuest ? guests : guestsToCancel).add(guest));
  }

  function keepGuest(guest: BookingGuest) {
    const isCancelingDasGuest = !!dasGuest && guestsToCancel.has(dasGuest);

    // The other guests were only selected because cancelling the DAS guest
    // cancels everyone, so keeping one of them starts the selection over.
    if (isCancelingDasGuest && guest !== dasGuest) {
      setGuestsToCancel(new Set());

      return;
    }

    const remainingGuestsToCancel = new Set(guestsToCancel);
    remainingGuestsToCancel.delete(guest);
    setGuestsToCancel(remainingGuestsToCancel);
  }

  async function cancelBooking() {
    if (isCancelingNone) {
      return;
    }

    await loadData(async () => {
      await client.cancelBooking([...guestsToCancel]);
      refreshPlans();
    });

    await goBack();
    onCancel(guests.filter(guest => !guestsToCancel.has(guest)));
  }

  return (
    <Screen title="Cancel Guests" theme={park.theme}>
      <h2>{name}</h2>
      <LandLine land={booking.land} />
      <ReturnTime start={booking.start} end={booking.end} />
      <div className="ml-3">
        <label className="flex items-center py-4">
          <input
            type="checkbox"
            checked={isCancelingAll}
            onChange={toggleAllGuests}
          />
          <span className="ml-3">Select All</span>
        </label>
      </div>
      {!isCancelingNone && (
        <div className="mb-4">
          <h3>Cancel These Guests</h3>
          <GuestList
            guests={guests.filter(guest => guestsToCancel.has(guest))}
            selectable={{
              isSelected: () => true,
              onToggle: keepGuest,
            }}
          />
        </div>
      )}
      {!isCancelingAll && (
        <div>
          <h3>Select Guests to Cancel</h3>
          <GuestList
            guests={guests.filter(guest => !guestsToCancel.has(guest))}
            selectable={{
              isSelected: () => false,
              onToggle: cancelGuest,
            }}
          />
        </div>
      )}
      <FloatingButton disabled={isCancelingNone} onClick={cancelBooking}>
        {`Cancel ${isCancelingAll ? 'Reservation' : 'Guests'}`}
      </FloatingButton>

      {loaderElem}
    </Screen>
  );
}
