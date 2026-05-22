import { createContext } from 'react';

import { Booking } from '@/api/itinerary';
import useDataLoader from '@/hooks/useDataLoader';
import useThrottleable from '@/hooks/useThrottleable';

interface PlansState {
  plans: Booking[];
  refreshPlans: ReturnType<typeof useThrottleable>;
  loaderElem: ReturnType<typeof useDataLoader>['loaderElem'];
  plansLoaded?: boolean;
}

export default createContext<PlansState>({
  plans: [],
  refreshPlans: () => undefined,
  loaderElem: null,
});
