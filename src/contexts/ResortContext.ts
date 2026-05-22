import { createContext } from 'react';

import { Resort } from '@/api/resort';

export default createContext<Resort>(
  new Resort('WDW', { experiences: {}, parks: [] })
);
