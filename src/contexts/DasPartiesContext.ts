import { createContext } from 'react';

import { DasParty } from '@/api/das';

export default createContext<Public<DasParty[]>>([]);
