import { ReactNode, createContext } from 'react';

import { Experience } from '@/api/ll';
import { Throttleable } from '@/hooks/useThrottleable';

type ExperiencesState = {
  experiences: Experience[];
  refreshExperiences: Throttleable;
  loaderElem: ReactNode;
};

export default createContext<ExperiencesState>({
  experiences: [],
  refreshExperiences: () => undefined,
  loaderElem: null,
});
