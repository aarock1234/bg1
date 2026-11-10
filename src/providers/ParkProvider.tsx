import { ReactNode, use, useEffect, useState } from 'react';

import { Park, Resort } from '@/api/resort';
import BookingDateContext from '@/contexts/BookingDateContext';
import ParkContext from '@/contexts/ParkContext';
import PlansContext from '@/contexts/PlansContext';
import ResortContext from '@/contexts/ResortContext';
import useUpdateParkFromPlans from '@/hooks/useUpdateParkFromPlans';
import kvdb from '@/kvdb';

export const PARK_KEY = 'bg1.park';

// Stands in until a park has been chosen. It has no ID, which marks it as not
// chosen, and otherwise looks like the resort's first park.
function placeholderPark(resort: Resort): Park {
  const [firstPark] = resort.parks;

  if (!firstPark) {
    throw new Error('resort has no parks');
  }

  return {
    ...firstPark,
    id: '',
  };
}

function loadSavedPark(resort: Resort): Park {
  const savedParkId = kvdb.getDaily(PARK_KEY);
  const savedPark = resort.parks.find(park => park.id === savedParkId);

  return savedPark ?? placeholderPark(resort);
}

type ParkProviderProps = {
  children: ReactNode;
};

export default function ParkProvider({ children }: ParkProviderProps) {
  const resort = use(ResortContext);
  const [park, setPark] = useState(() => loadSavedPark(resort));
  const isParkChosen = park.id !== '';

  useEffect(() => {
    if (park.id) {
      kvdb.setDaily(PARK_KEY, park.id);
    }
  }, [park]);

  return (
    <ParkContext
      value={{
        park,
        setPark,
      }}
    >
      {isParkChosen ? children : <ParkInitializer />}
    </ParkContext>
  );
}

// Chooses the park from the plans once they have loaded, and shows the plans
// loader until then.
function ParkInitializer() {
  const { plansLoaded, loaderElem } = use(PlansContext);
  const { bookingDate } = use(BookingDateContext);
  const updateParkFromPlans = useUpdateParkFromPlans();

  useEffect(() => {
    if (plansLoaded) {
      updateParkFromPlans(bookingDate);
    }
  }, [plansLoaded, bookingDate, updateParkFromPlans]);

  return loaderElem;
}
