import { Dispatch, SetStateAction, createContext } from 'react';

import { Park } from '@/api/resort';

type ParkState = {
  park: Park;
  setPark: Dispatch<SetStateAction<Park>>;
};

// The default park is an empty stand-in: every consumer renders below a
// ParkProvider that supplies a real park.
export default createContext<ParkState>({
  park: {} as Park,
  setPark: () => undefined,
});
