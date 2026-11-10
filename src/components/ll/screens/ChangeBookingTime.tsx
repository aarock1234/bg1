import { use, useEffect, useState } from 'react';

import { LLMP, Offer } from '@/api/ll';
import Button from '@/components/Button';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import RebookingContext from '@/contexts/RebookingContext';
import useDataLoader from '@/hooks/useDataLoader';

import BookingDate from '../BookingDate';
import ReturnTime from '../ReturnTime';
import YourDayButton from '../YourDayButton';
import BookNewReturnTime from './BookNewReturnTime';
import RefreshButton from './RefreshButton';
import SelectReturnTime from './SelectReturnTime';

type ChangeBookingTimeProps = {
  booking: LLMP;
};

type LoadingOfferProps = {
  booking: LLMP;
  loaderElem: React.ReactNode;
};

// Stands in for SelectReturnTime, with inert buttons, until there is an offer
// to select times from.
function LoadingOffer({ booking, loaderElem }: LoadingOfferProps) {
  return (
    <Screen
      title="Select Return Time"
      theme={booking.park.theme}
      subhead={<BookingDate booking={booking} />}
      buttons={
        <>
          <YourDayButton />
          <RefreshButton name="Times" onClick={() => undefined} />
        </>
      }
    >
      <h2>{booking.name}</h2>
      <LandLine land={booking.land} />
      <ReturnTime
        start={booking.start}
        end={booking.end}
        button={<Button type="small">Keep</Button>}
      />
      {loaderElem}
    </Screen>
  );
}

// Lets the guest pick a new return time for an existing Lightning Lane.
export default function ChangeBookingTime({ booking }: ChangeBookingTimeProps) {
  const { goTo } = use(NavContext);
  const { end: endRebooking } = use(RebookingContext);
  const { ll } = use(ClientsContext);
  const { loadData, loaderElem } = useDataLoader();
  const [offer, setOffer] = useState<Offer<LLMP>>();

  useEffect(() => {
    endRebooking();
  }, [endRebooking]);

  useEffect(() => {
    loadData(async () => {
      const newOffer = await ll.offer(booking.experience, booking.guests, {
        booking,
      });

      setOffer(newOffer);
    });
  }, [booking, ll, loadData]);

  if (!offer) {
    return <LoadingOffer booking={booking} loaderElem={loaderElem} />;
  }

  return (
    <SelectReturnTime
      offer={offer}
      onOfferChange={newOffer => {
        goTo(<BookNewReturnTime offer={newOffer} />);
      }}
    />
  );
}
