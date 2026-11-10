import {
  ReactElement,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { FlexExperience } from '@/api/ll';
import { Park } from '@/api/resort';
import Select from '@/components/Select';
import BookingDateContext from '@/contexts/BookingDateContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import ParkContext from '@/contexts/ParkContext';
import { parkDate } from '@/datetime';
import useCoords, { Coords } from '@/hooks/useCoords';
import kvdb from '@/kvdb';

export const SORT_KEY = 'bg1.genie.sort';

// Sort types in the order they are offered.
const SORT_TYPES = [
  'priority',
  'nearby',
  'standby',
  'soonest',
  'aToZ',
] as const;

type SortType = (typeof SORT_TYPES)[number];

const DEFAULT_SORT_TYPE: SortType = 'priority';

const SORT_LABELS: Record<SortType, string> = {
  priority: 'Priority',
  nearby: 'Nearby',
  standby: 'Standby',
  soonest: 'Soonest',
  aToZ: 'A to Z',
};

// Sorts experiences with no priority after every prioritized one.
const NO_PRIORITY = Infinity;

// Sorts experiences with no known wait after every one that has a wait.
const NO_WAIT = -1;

// Sorts experiences with no return time after every one that has a time.
const NO_RETURN_TIME = 86_400;

type SortOptions = {
  coords?: Coords;
  isToday?: boolean;
};

export type Sorter = (
  a: FlexExperience,
  b: FlexExperience,
  options?: SortOptions
) => number;

type SortOption = {
  text: string;
};

type SortSelectProps = {
  className?: string;
};

type SortHook = {
  sortType: SortType;
  sorter: Sorter;
  SortSelect: (props: SortSelectProps) => ReactElement;
};

function isSortType(value: unknown): value is SortType {
  return SORT_TYPES.some(sortType => sortType === value);
}

function compareAverageWaits(a: FlexExperience, b: FlexExperience): number {
  return (b.avgWait ?? NO_WAIT) - (a.avgWait ?? NO_WAIT);
}

function sortByPriority(a: FlexExperience, b: FlexExperience): number {
  return (
    (a.priority ?? NO_PRIORITY) - (b.priority ?? NO_PRIORITY) ||
    compareAverageWaits(a, b)
  );
}

// Sorts by the posted wait today. Future dates have no posted waits, so they
// sort virtual queues first and then by average wait.
function sortByStandby(
  a: FlexExperience,
  b: FlexExperience,
  { isToday }: SortOptions = {}
): number {
  if (isToday) {
    return (b.standby.waitTime ?? NO_WAIT) - (a.standby.waitTime ?? NO_WAIT);
  }

  return (
    Number(!a.virtualQueue) - Number(!b.virtualQueue) ||
    compareAverageWaits(a, b)
  );
}

function sortBySoonest(a: FlexExperience, b: FlexExperience): number {
  return (
    Number(a.flex.nextAvailableTime ?? NO_RETURN_TIME) -
    Number(b.flex.nextAvailableTime ?? NO_RETURN_TIME)
  );
}

function sortByName(a: FlexExperience, b: FlexExperience): number {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

function distance(a: Coords, b: Coords): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Sorts experiences with no known location after every one that has one.
function sortByNearby(
  a: FlexExperience,
  b: FlexExperience,
  { coords }: SortOptions = {}
): number {
  if (a.geo === b.geo) {
    return 0;
  }

  if (!a.geo) {
    return 1;
  }

  if (!b.geo) {
    return -1;
  }

  if (!coords) {
    return 0;
  }

  return distance(a.geo, coords) - distance(b.geo, coords);
}

const SORTERS: Record<SortType, Sorter> = {
  priority: sortByPriority,
  nearby: sortByNearby,
  standby: sortByStandby,
  soonest: sortBySoonest,
  aToZ: sortByName,
};

// Available Lightning Lanes sort before unavailable ones.
function compareAvailability(a: FlexExperience, b: FlexExperience): number {
  return Number(b.flex.available) - Number(a.flex.available);
}

function inPark(park: Park, coords: Coords): boolean {
  const { n, s, e, w } = park.geo;
  const [latitude, longitude] = coords;

  return latitude < n && latitude > s && longitude < e && longitude > w;
}

// Sorting by distance only makes sense on the day of the visit.
function sortOptionsFor(isToday: boolean): Map<SortType, SortOption> {
  const sortOptions = new Map<SortType, SortOption>();

  for (const sortType of SORT_TYPES) {
    if (sortType === 'nearby' && !isToday) {
      continue;
    }

    sortOptions.set(sortType, {
      text: SORT_LABELS[sortType],
    });
  }

  return sortOptions;
}

export default function useSort(): SortHook {
  const { park } = use(ParkContext);
  const { experiences } = use(ExperiencesContext);
  const [coords, updateCoords] = useCoords();
  const { bookingDate } = use(BookingDateContext);
  const isToday = bookingDate === parkDate();
  const sortOptions = useMemo(() => sortOptionsFor(isToday), [isToday]);

  const [sortType, setSortType] = useState<SortType>(() => {
    const savedType = kvdb.get(SORT_KEY);

    return isSortType(savedType) && sortOptions.has(savedType)
      ? savedType
      : DEFAULT_SORT_TYPE;
  });

  useEffect(() => {
    setSortType(currentType =>
      sortOptions.has(currentType) ? currentType : DEFAULT_SORT_TYPE
    );
  }, [sortOptions]);

  useEffect(() => {
    if (sortType === 'nearby') {
      updateCoords();
    }
  }, [experiences, sortType, updateCoords]);

  // Sorting by distance falls back to the default while the guest's location
  // is unknown or outside the park.
  const isInPark = coords !== undefined && inPark(park, coords);
  const activeSortType =
    sortType === 'nearby' && !isInPark ? DEFAULT_SORT_TYPE : sortType;

  const sorter = useCallback<Sorter>(
    (a, b) => {
      const sortByType = SORTERS[activeSortType];
      const options = {
        coords,
        isToday,
      };

      return (
        compareAvailability(a, b) ||
        sortByType(a, b, options) ||
        sortByName(a, b)
      );
    },
    [activeSortType, coords, isToday]
  );

  function changeSortType(type: SortType) {
    setSortType(type);
    kvdb.set(SORT_KEY, type);
  }

  function SortSelect(props: SortSelectProps) {
    return (
      <Select
        {...props}
        options={sortOptions}
        selected={sortType}
        onChange={changeSortType}
        title="Sort By"
      />
    );
  }

  return {
    sortType,
    sorter,
    SortSelect,
  };
}
