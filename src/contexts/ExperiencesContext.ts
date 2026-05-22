import { createContext } from 'react';

import { Experience } from '@/api/ll';
import useDataLoader from '@/hooks/useDataLoader';
import useThrottleable from '@/hooks/useThrottleable';

interface ExperiencesState {
  experiences: Experience[];
  refreshExperiences: ReturnType<typeof useThrottleable>;
  loaderElem: ReturnType<typeof useDataLoader>['loaderElem'];
}

export default createContext<ExperiencesState>({
  experiences: [],
  refreshExperiences: () => undefined,
  loaderElem: null,
});
