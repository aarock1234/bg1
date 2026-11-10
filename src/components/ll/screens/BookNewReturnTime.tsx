import { use, useEffect, useState } from 'react';

import { LLMP, Offer } from '@/api/ll';
import Button from '@/components/Button';
import FloatingButton from '@/components/FloatingButton';
import GuestList from '@/components/GuestList';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import PlansContext from '@/contexts/PlansContext';
import RebookingContext from '@/contexts/RebookingContext';
import ResortContext from '@/contexts/ResortContext';
import useDataLoader from '@/hooks/useDataLoader';
import { ping } from '@/ping';

import BookingDate from '../BookingDate';
import OverlappingPlans from '../OverlappingPlans';
import RebookingHeader from '../RebookingHeader';
import { ReturnTimeCard } from '../ReturnTime';
import YourDayButton from '../YourDayButton';
import BookingDetails from './BookingDetails';
import Home from './Home';
import SelectReturnTime from './SelectReturnTime';

type BookNewReturnTimeProps = {
  offer: Offer<LLMP>;
};

// Confirms moving an existing Lightning Lane to the offered return time.
export default function BookNewReturnTime({
  offer: initialOffer,
}: BookNewReturnTimeProps) {
  const { goTo, goBack } = use(NavContext);
  const { begin: beginRebooking, end: endRebooking } = use(RebookingContext);
  const resort = use(ResortContext);
  const { ll } = use(ClientsContext);
  const { refreshPlans } = use(PlansContext);
  const { loadData, loaderElem } = useDataLoader();
  const [offer, setOffer] = useState(initialOffer);
  const { booking, experience } = offer;

  useEffect(() => {
    beginRebooking(booking, true);

    return endRebooking;
  }, [booking, beginRebooking, endRebooking]);

  function book() {
    loadData(async () => {
      const newBooking = await ll.book(offer);

      refreshPlans();
      await goBack({
        screen: Home,
      });
      goTo(<BookingDetails booking={newBooking} isNew />);
      ping(resort, 'G');
    });
  }

  function selectReturnTime() {
    goTo(<SelectReturnTime offer={offer} onOfferChange={setOffer} />);
  }

  return (
    <Screen
      title="Lightning Lane"
      subhead={
        <>
          <RebookingHeader
            back={{
              screen: BookingDetails,
            }}
          />
          <BookingDate booking={booking} />
        </>
      }
      theme={experience.park.theme}
      buttons={<YourDayButton />}
    >
      <h2 className="mt-5">{experience.name}</h2>
      <LandLine land={experience.land} />
      <ReturnTimeCard
        {...offer}
        button={
          <Button type="small" onClick={selectReturnTime}>
            Change
          </Button>
        }
      />
      <OverlappingPlans offer={offer} />
      <h3>Your Party</h3>
      <GuestList guests={offer.guests.eligible} />
      {loaderElem}
      <FloatingButton onClick={book}>Modify Lightning Lane</FloatingButton>
    </Screen>
  );
}
