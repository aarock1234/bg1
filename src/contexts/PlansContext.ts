import { ReactNode, createContext } from 'react';

import { Booking } from '@/api/itinerary';
import { Throttleable } from '@/hooks/useThrottleable';

type PlansState = {
  plans: Booking[];
  refreshPlans: Throttleable;
  loaderElem: ReactNode;
  plansLoaded?: boolean;
};

export default createContext<PlansState>({
  plans: [],
  refreshPlans: () => undefined,
  loaderElem: null,
});
