import { use, useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { Experience } from '@/api/ll';
import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import ParkContext from '@/contexts/ParkContext';
import useDataLoader from '@/hooks/useDataLoader';
import useThrottleable from '@/hooks/useThrottleable';

export default function ExperiencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ll, liveData } = use(ClientsContext);
  const { park } = use(ParkContext);
  const { bookingDate } = use(BookingDateContext);
  const { loadData, loaderElem } = useDataLoader();
  const [experiences, setExperiences] = useState<Experience[]>([]);

  const refreshExperiences = useThrottleable(
    useCallback(() => {
      loadData(async () => {
        const showsPromise = liveData.shows(park);
        let exps = {
          ...Object.fromEntries(
            (await ll.experiences(park, bookingDate)).map(exp => [exp.id, exp])
          ),
        };
        try {
          exps = { ...(await showsPromise), ...exps };
        } catch (error) {
          console.error(error);
        }
        setExperiences(Object.values(exps));
      });
    }, [park, bookingDate, ll, liveData, loadData])
  );

  useLayoutEffect(() => setExperiences([]), [park, bookingDate]);

  useEffect(refreshExperiences, [refreshExperiences]);

  return (
    <ExperiencesContext value={{ experiences, refreshExperiences, loaderElem }}>
      {children}
    </ExperiencesContext>
  );
}
