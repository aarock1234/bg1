import { ReactNode, use, useCallback, useEffect, useState } from 'react';

import { LiveDataClient } from '@/api/livedata';
import { Experience } from '@/api/ll';
import { Park } from '@/api/resort';
import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import ParkContext from '@/contexts/ParkContext';
import useDataLoader from '@/hooks/useDataLoader';
import useThrottleable from '@/hooks/useThrottleable';

// Shows are an extra: when they can't be loaded, the Lightning Lane
// experiences are listed without them.
async function loadShows(
  liveData: LiveDataClient,
  park: Park
): Promise<Record<string, Experience>> {
  try {
    return await liveData.shows(park);
  } catch (error) {
    console.error(error);

    return {};
  }
}

type ExperiencesProviderProps = {
  children: ReactNode;
};

export default function ExperiencesProvider({
  children,
}: ExperiencesProviderProps) {
  const { ll, liveData } = use(ClientsContext);
  const { park } = use(ParkContext);
  const { bookingDate } = use(BookingDateContext);
  const { loadData, loaderElem } = useDataLoader();
  const [experiences, setExperiences] = useState<Experience[]>([]);

  const loadExperiences = useCallback(() => {
    loadData(async () => {
      const showsPromise = loadShows(liveData, park);
      const llExperiences = await ll.experiences(park, bookingDate);
      const shows = await showsPromise;

      // A show that is also a Lightning Lane experience is listed once, as
      // the Lightning Lane experience.
      const experiencesById = {
        ...shows,
        ...Object.fromEntries(
          llExperiences.map(experience => [experience.id, experience])
        ),
      };

      setExperiences(Object.values(experiencesById));
    });
  }, [park, bookingDate, ll, liveData, loadData]);

  const refreshExperiences = useThrottleable(loadExperiences);

  // Another park's experiences are never shown. A booking date change keeps
  // the current list visible until the new one has loaded.
  useEffect(() => {
    setExperiences([]);
  }, [park]);

  useEffect(() => {
    refreshExperiences();
  }, [refreshExperiences]);

  return (
    <ExperiencesContext
      value={{
        experiences,
        refreshExperiences,
        loaderElem,
      }}
    >
      {children}
    </ExperiencesContext>
  );
}
