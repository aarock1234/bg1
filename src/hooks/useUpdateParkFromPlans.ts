import { use, useCallback } from 'react';

import { Booking, isLLMP } from '@/api/itinerary';
import { Park, Resort } from '@/api/resort';
import ParkContext from '@/contexts/ParkContext';
import PlansContext from '@/contexts/PlansContext';
import ResortContext from '@/contexts/ResortContext';
import { parkDate } from '@/datetime';

// Finds the park the plans suggest for a date. A Lightning Lane booking
// decides it: today the latest one, and on any other date the first one.
// Without a Lightning Lane, the first plan in one of the resort's parks
// decides it. Plans are ordered by start time.
function findPlannedPark(
  plans: Booking[],
  date: string,
  resort: Resort
): Park | undefined {
  const isToday = date === parkDate();
  const resortParkIds = new Set(resort.parks.map(park => park.id));
  let plannedPark: Park | undefined;

  for (const booking of plans) {
    const bookingDate = parkDate(booking.start);

    if (bookingDate < date) {
      continue;
    }

    if (bookingDate > date) {
      break;
    }

    if (isLLMP(booking)) {
      plannedPark = booking.park;

      if (!isToday) {
        break;
      }
    }

    if (!plannedPark && resortParkIds.has(booking.park.id)) {
      plannedPark = booking.park;
    }
  }

  return plannedPark;
}

// Returns a function that selects the park the plans suggest for a date. When
// the plans suggest none, the selected park stays, and the resort's first
// park is selected if there wasn't one yet.
export default function useUpdateParkFromPlans(): (date: string) => void {
  const resort = use(ResortContext);
  const { setPark } = use(ParkContext);
  const { plans } = use(PlansContext);

  return useCallback(
    (date: string) => {
      const plannedPark = findPlannedPark(plans, date, resort);
      const [firstPark] = resort.parks;

      setPark(previousPark => {
        if (plannedPark) {
          return plannedPark;
        }

        if (previousPark.id) {
          return previousPark;
        }

        return firstPark ?? previousPark;
      });
    },
    [plans, resort, setPark]
  );
}
