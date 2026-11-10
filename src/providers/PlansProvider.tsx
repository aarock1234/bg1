import { ReactNode, use, useCallback, useEffect, useState } from 'react';

import { Booking } from '@/api/itinerary';
import ClientsContext from '@/contexts/ClientsContext';
import PlansContext from '@/contexts/PlansContext';
import useDataLoader from '@/hooks/useDataLoader';
import useThrottleable from '@/hooks/useThrottleable';

type PlansProviderProps = {
  children: ReactNode;
};

export default function PlansProvider({ children }: PlansProviderProps) {
  const { itinerary } = use(ClientsContext);
  const { loadData, loaderElem } = useDataLoader();
  const [plans, setPlans] = useState<Booking[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);

  const loadPlans = useCallback(() => {
    loadData(async () => {
      setPlans(await itinerary.plans());
      setPlansLoaded(true);
    });
  }, [itinerary, loadData]);

  const refreshPlans = useThrottleable(loadPlans);

  useEffect(() => {
    refreshPlans();
  }, [refreshPlans]);

  return (
    <PlansContext
      value={{
        plans,
        plansLoaded,
        refreshPlans,
        loaderElem,
      }}
    >
      {children}
    </PlansContext>
  );
}
