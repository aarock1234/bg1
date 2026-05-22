import { createContext } from 'react';

import { Park } from '@/api/resort';

interface ParkState {
  park: Park;
  setPark: React.Dispatch<React.SetStateAction<Park>>;
}

export default createContext<ParkState>({
  park: {} as Park,
  setPark: () => undefined,
});
