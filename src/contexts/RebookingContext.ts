import { createContext } from 'react';

import { LLMP } from '@/api/itinerary';

export type Rebooking = {
  // The booking being replaced, if a rebooking is in progress.
  current: LLMP | undefined;
  // Whether the rebooking was started automatically rather than by the user.
  auto: boolean;
  begin: (booking: LLMP, auto?: boolean) => void;
  end: () => void;
};

export default createContext<Rebooking>({
  current: undefined,
  auto: false,
  begin: () => undefined,
  end: () => undefined,
});
