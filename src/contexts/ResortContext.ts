import { createContext } from 'react';

import { Resort } from '@/api/resort';

const EMPTY_RESORT = new Resort('WDW', {
  experiences: {},
  parks: [],
});

export default createContext<Resort>(EMPTY_RESORT);
