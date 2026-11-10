import { memo, use, useEffect, useRef, useState } from 'react';

import { Booking, isLLMP } from '@/api/itinerary';
import { Experience, FlexExperience } from '@/api/ll';
import { Park, Theme } from '@/api/resort';
import Screen from '@/components/Screen';
import Tab from '@/components/Tab';
import { Time } from '@/components/Time';
import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import NavContext from '@/contexts/NavContext';
import ParkContext from '@/contexts/ParkContext';
import PlansContext from '@/contexts/PlansContext';
import ResortContext from '@/contexts/ResortContext';
import ThemeContext from '@/contexts/ThemeContext';
import { DateTime, ParkTime, parkDate, upcomingTimes } from '@/datetime';
import useSavedParty from '@/hooks/useSavedParty';
import CheckmarkIcon from '@/icons/CheckmarkIcon';
import DropIcon from '@/icons/DropIcon';
import { IconProps } from '@/icons/Icon';
import LightningIcon from '@/icons/LightningIcon';
import StarIcon from '@/icons/StarIcon';
import kvdb from '@/kvdb';

import RebookingHeader from '../../RebookingHeader';
import { HomeTabProps } from '../Home';
import RefreshButton from '../RefreshButton';
import BookingDateSelect from './BookingDateSelect';
import LLButton from './LLButton';
import LabeledItem from './LabeledItem';
import Legend, { Symbol } from './Legend';
import ParkSelect from './ParkSelect';
import StandbyTime from './StandbyTime';
import TimeBanner from './TimeBanner';
import useSort, { Sorter } from './useSort';

export const STARRED_KEY = 'bg1.genie.tipBoard.starred';

const LIGHTNING_PICK = 'Lightning Pick';
const BOOKED = 'Booked';

// The shortest standby wait, in minutes, that a Lightning Pick can have.
const LP_MIN_STANDBY = 30;

// The longest a Lightning Pick's return time can be away, in minutes.
const LP_MAX_LL_WAIT = 60;

// Only experiences in a priority level below this can be Lightning Picks.
const LP_PRIORITY_LEVEL_LIMIT = 3;

// The priority level of an experience that has no priority.
const LOWEST_PRIORITY_LEVEL = 4;

const SECONDS_PER_MINUTE = 60;

export type ExtFlexExp = FlexExperience & {
  booked: boolean;
  lp: boolean;
  starred: boolean;
};

function isFlexExperience(
  experience: Experience
): experience is FlexExperience {
  return !!experience.flex;
}

// Starred experiences stay in the main list even after they are experienced.
function isExperienced(experience: ExtFlexExp): boolean {
  return !!experience.experienced && !experience.starred;
}

function loadStarredIds(): Set<string> {
  const ids = kvdb.get(STARRED_KEY);

  if (!Array.isArray(ids)) {
    return new Set();
  }

  return new Set(ids.map(String));
}

function bookedExperienceIds(plans: Booking[], date: string): Set<string> {
  const bookingsOnDate = plans
    .filter(isLLMP)
    .filter(booking => booking.start.date === date);

  return new Set(bookingsOnDate.map(booking => booking.experience.id));
}

// A Lightning Pick has a long standby wait and a return time in the near
// future. How near depends on its priority level: the top level allows a
// return time as far away as the standby wait, and each level below it allows
// a third less, never exceeding LP_MAX_LL_WAIT.
function isLightningPick(experience: FlexExperience, now: ParkTime): boolean {
  const { nextAvailableTime } = experience.flex;
  const standbyWait = experience.standby.waitTime ?? 0;
  const priorityLevel = Math.trunc(
    experience.priority ?? LOWEST_PRIORITY_LEVEL
  );
  const isEligible =
    standbyWait >= LP_MIN_STANDBY && priorityLevel < LP_PRIORITY_LEVEL_LIMIT;

  if (!nextAvailableTime || !isEligible) {
    return false;
  }

  const standbyShare =
    (LOWEST_PRIORITY_LEVEL - priorityLevel) / LP_PRIORITY_LEVEL_LIMIT;
  const maxWaitMinutes = Math.min(LP_MAX_LL_WAIT, standbyShare * standbyWait);
  const waitSeconds = Number(nextAvailableTime) - Number(now);

  return waitSeconds <= maxWaitMinutes * SECONDS_PER_MINUTE;
}

// Returns the next drop time when booking for today. A future date has all of
// its drops still to come, so its first one is returned.
function firstDropTime(
  dropTimes: ParkTime[],
  isBookingToday: boolean
): ParkTime | undefined {
  if (isBookingToday) {
    return upcomingTimes(dropTimes)[0];
  }

  return dropTimes[0];
}

// Returns the parks that have drops, starting with `firstPark`.
function dropParks(parks: Park[], firstPark: Park): Park[] {
  const parksWithDrops = parks.filter(park => park.dropTimes.length > 0);

  return [
    ...parksWithDrops.filter(park => park === firstPark),
    ...parksWithDrops.filter(park => park !== firstPark),
  ];
}

function thrillDataUrl(resortId: string, park: Park): string {
  const resortSlug = resortId.toLowerCase();
  const parkSlug = park.name.toLowerCase().replaceAll(' ', '-');

  return `https://www.thrill-data.com/waits/park/${resortSlug}/${parkSlug}/`;
}

export default function MultiPassList({ ref }: HomeTabProps) {
  useSavedParty();
  const { ll } = use(ClientsContext);
  const { park } = use(ParkContext);
  const { experiences, refreshExperiences, loaderElem } =
    use(ExperiencesContext);
  const { bookingDate } = use(BookingDateContext);
  const { sortType, sorter, SortSelect } = useSort();
  const isFirstUpdate = useRef(true);

  useEffect(() => {
    if (!isFirstUpdate.current) {
      ref.current?.scroll(0, 0);
    }
  }, [sortType, ref]);

  useEffect(() => {
    isFirstUpdate.current = false;
  }, []);

  const isBookingToday = bookingDate === parkDate();
  const dropTime = upcomingTimes(park.dropTimes)[0];

  return (
    <Tab
      title={<abbr title="Lightning Lane">LL</abbr>}
      buttons={
        <>
          {ll.rules.prebook && <BookingDateSelect />}
          <SortSelect />
          <ParkSelect />
          <RefreshButton
            name="Experiences"
            onClick={() => refreshExperiences()}
          />
        </>
      }
      subhead={
        <>
          <RebookingHeader />
          {isBookingToday && (
            <TimeBanner bookTime={ll.nextBookTime} dropTime={dropTime} />
          )}
        </>
      }
      ref={ref}
    >
      <Experiences experiences={experiences} park={park} sorter={sorter} />
      {loaderElem}
    </Tab>
  );
}

type ExperiencesProps = {
  experiences: Experience[];
  park: Park;
  sorter: Sorter;
};

const Experiences = memo(function Experiences(props: ExperiencesProps) {
  const { experiences, park, sorter } = props;
  const theme = use(ThemeContext);
  const { plans } = use(PlansContext);
  const { bookingDate } = use(BookingDateContext);
  const [starred, setStarred] = useState(loadStarredIds);
  const isBookingToday = bookingDate === parkDate();
  const now = DateTime.now().time;

  useEffect(() => {
    kvdb.set(STARRED_KEY, [...starred]);
  }, [starred]);

  function toggleStar({ id }: ExtFlexExp) {
    setStarred(currentIds => {
      const updatedIds = new Set(currentIds);

      if (updatedIds.has(id)) {
        updatedIds.delete(id);
      } else {
        updatedIds.add(id);
      }

      return updatedIds;
    });
  }

  const bookedIds = bookedExperienceIds(plans, bookingDate);

  const flexExperiences = experiences
    .filter(isFlexExperience)
    .map((experience): ExtFlexExp => {
      return {
        ...experience,
        booked: bookedIds.has(experience.id),
        lp: isBookingToday && isLightningPick(experience, now),
        starred: starred.has(experience.id),
      };
    })
    .sort((a, b) => {
      return (
        Number(b.starred) - Number(a.starred) ||
        Number(b.lp) - Number(a.lp) ||
        sorter(a, b)
      );
    });

  const unexperienced = flexExperiences.filter(
    experience => !isExperienced(experience)
  );
  const experienced = flexExperiences
    .filter(isExperienced)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <ExperienceList
        experiences={unexperienced}
        park={park}
        type="unexperienced"
        isBookingToday={isBookingToday}
        onStarToggle={toggleStar}
      />

      {experienced.length > 0 && (
        <>
          <h2
            className={`-mx-3 px-3 py-1 text-sm uppercase text-center ${theme.bg} text-white`}
          >
            Experienced or Expired
          </h2>
          <ExperienceList
            experiences={experienced}
            park={park}
            type="experienced"
            isBookingToday={isBookingToday}
            onStarToggle={toggleStar}
          />
        </>
      )}

      {flexExperiences.length > 0 && (
        <>
          <SymbolsLegend park={park} />
          {!isBookingToday && <AverageStandbyNote park={park} />}
        </>
      )}
    </>
  );
});

type ExperienceListProps = {
  experiences: ExtFlexExp[];
  park: Park;
  type: string;
  isBookingToday: boolean;
  onStarToggle: (experience: ExtFlexExp) => void;
};

function ExperienceList(props: ExperienceListProps) {
  const { experiences, park, type, isBookingToday, onStarToggle } = props;

  return (
    <ul className="dividers" data-testid={type}>
      {experiences.map(experience => (
        <ExperienceItem
          experience={experience}
          park={park}
          isBookingToday={isBookingToday}
          onStarToggle={onStarToggle}
          key={`${experience.id}${experience.starred ? '*' : ''}`}
        />
      ))}
    </ul>
  );
}

type ExperienceItemProps = {
  experience: ExtFlexExp;
  park: Park;
  isBookingToday: boolean;
  onStarToggle: (experience: ExtFlexExp) => void;
};

function ExperienceItem(props: ExperienceItemProps) {
  const { experience, park, isBookingToday, onStarToggle } = props;
  const { goTo } = use(NavContext);

  return (
    <li>
      <div className="flex items-center gap-x-2">
        <StarButton experience={experience} onToggle={onStarToggle} />
        <h3 className="flex-1 mt-0 text-lg font-semibold leading-tight truncate">
          {experience.name}
        </h3>
        <AvailabilityInfoButton
          experience={experience}
          park={park}
          isBookingToday={isBookingToday}
        />
        {experience.booked && (
          <InfoButton
            name={BOOKED}
            icon={CheckmarkIcon}
            onClick={() => goTo(<BookedDesc />)}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <StandbyTime experience={experience} average={!isBookingToday} />
        <LabeledItem label="LL">
          <LLButton experience={experience} />
        </LabeledItem>
      </div>
    </li>
  );
}

type AvailabilityInfoButtonProps = {
  experience: ExtFlexExp;
  park: Park;
  isBookingToday: boolean;
};

// Marks a Lightning Pick, or else an experience that has a drop coming. The
// drop is the "next" one when it is also the park's next drop.
function AvailabilityInfoButton(props: AvailabilityInfoButtonProps) {
  const { experience, park, isBookingToday } = props;
  const { goTo } = use(NavContext);
  const experienceDropTime = firstDropTime(
    experience.dropTimes ?? [],
    isBookingToday
  );
  const parkDropTime = firstDropTime(park.dropTimes, isBookingToday);

  function showDropTimeDesc() {
    goTo(
      <DropTimeDesc
        park={park}
        experience={experience}
        isBookingToday={isBookingToday}
      />
    );
  }

  if (experience.lp) {
    return (
      <InfoButton
        name={LIGHTNING_PICK}
        icon={LightningIcon}
        onClick={() => goTo(<LightningPickDesc />)}
      />
    );
  }

  if (!experienceDropTime) {
    return null;
  }

  if (experienceDropTime.equals(parkDropTime)) {
    return (
      <InfoButton name="Next Drop" icon={DropIcon} onClick={showDropTimeDesc} />
    );
  }

  return (
    <InfoButton
      name="Future Drop"
      icon={DropIcon}
      onClick={showDropTimeDesc}
      className="opacity-50"
    />
  );
}

type InfoButtonProps = {
  name: string;
  icon: React.FunctionComponent<IconProps>;
  onClick: () => void;
  className?: string;
};

function InfoButton({ name, icon: Icon, onClick, className }: InfoButtonProps) {
  return (
    <button
      aria-label={`${name} (more info)`}
      className={`-mx-2 px-2 ${className ?? ''}`}
      onClick={onClick}
    >
      <Icon themed />
    </button>
  );
}

type StarButtonProps = {
  experience: ExtFlexExp;
  onToggle: (experience: ExtFlexExp) => void;
};

function StarButton({ experience, onToggle }: StarButtonProps) {
  const action = experience.starred ? 'Remove from' : 'Add to';

  return (
    <button
      title={`${action} Favorites`}
      className="-m-2 p-2 text-gray-300"
      onClick={() => onToggle(experience)}
    >
      <StarIcon themed={experience.starred} />
    </button>
  );
}

type SymbolsLegendProps = {
  park: Park;
};

function SymbolsLegend({ park }: SymbolsLegendProps) {
  const { goTo } = use(NavContext);

  return (
    <Legend title="Symbols">
      <Symbol
        sym={<LightningIcon themed />}
        def={LIGHTNING_PICK}
        onInfo={() => goTo(<LightningPickDesc />)}
      />
      {park.dropTimes.length > 0 && (
        <Symbol
          sym={
            <div className="flex gap-x-1">
              <DropIcon themed /> / <DropIcon themed className="opacity-50" />
            </div>
          }
          def="Next/Future Drop"
          onInfo={() => goTo(<DropTimeDesc park={park} />)}
        />
      )}
      <Symbol
        sym={<CheckmarkIcon themed />}
        def={BOOKED}
        onInfo={() => goTo(<BookedDesc />)}
      />
    </Legend>
  );
}

type AverageStandbyNoteProps = {
  park: Park;
};

function AverageStandbyNote({ park }: AverageStandbyNoteProps) {
  const resort = use(ResortContext);

  return (
    <p className="text-sm">
      Standby times for future dates are monthly averages (source:{' '}
      <a
        href={thrillDataUrl(resort.id, park)}
        target="_blank"
        rel="noreferrer"
        className="whitespace-nowrap"
      >
        Thrill Data
      </a>
      ) meant to assist you in selecting your initial{' '}
      <abbr title="Lightning Lanes">LLs</abbr>. They are not wait time estimates
      for this particular day.
    </p>
  );
}

function LightningPickDesc() {
  return (
    <Screen title={LIGHTNING_PICK}>
      <p>
        When an attraction with a long standby wait has a Lightning Lane return
        time in the near future, it's highlighted as a Lightning Pick. Book
        these quick before they're gone!
      </p>
    </Screen>
  );
}

type DropTimeDescProps = {
  park: Park;
  experience?: Experience;
  isBookingToday?: boolean;
};

function DropTimeDesc(props: DropTimeDescProps) {
  const { park, experience, isBookingToday = false } = props;
  const resort = use(ResortContext);
  const dropTime = upcomingTimes(experience?.dropTimes ?? [])[0];

  return (
    <Screen title="Upcoming Drop">
      <p>
        {experience ? <b>{experience.name}</b> : 'This attraction'} may be part
        of <DropName dropTime={dropTime} isBookingToday={isBookingToday} /> drop
        of additional Lightning Lane inventory, with earlier return times than
        what's currently being offered. Availability varies but is always
        limited, so be sure you're ready to book when the drop time arrives!
      </p>

      {dropParks(resort.parks, park).map(dropPark => (
        <ParkDropTimes
          park={dropPark}
          isBookingToday={isBookingToday}
          key={dropPark.id}
        />
      ))}
    </Screen>
  );
}

type DropNameProps = {
  dropTime?: ParkTime;
  isBookingToday: boolean;
};

// Names the drop as specifically as possible: "the 1:30 PM", "an upcoming" or,
// for a future date, "a day-of".
function DropName({ dropTime, isBookingToday }: DropNameProps) {
  if (!isBookingToday) {
    return 'a day-of';
  }

  if (!dropTime) {
    return 'an upcoming';
  }

  return (
    <>
      the <Time time={dropTime} className="font-semibold" />
    </>
  );
}

type ParkDropTimesProps = {
  park: Park;
  isBookingToday: boolean;
};

function ParkDropTimes({ park, isBookingToday }: ParkDropTimesProps) {
  const resort = use(ResortContext);
  const nextDropTime = upcomingTimes(park.dropTimes)[0];

  return (
    <div className={`mt-5 rounded-sm overflow-hidden ${park.theme.bg}`}>
      <h2
        className={`mt-0 py-1 ${park.theme.bg} text-white text-base text-center`}
      >
        {park.name}
      </h2>
      <div className="flex flex-col px-2 pb-3 bg-white/90">
        {resort.dropExperiences(park).map(experience => (
          <ExperienceDropTimes
            experience={experience}
            theme={park.theme}
            nextDropTime={nextDropTime}
            isBookingToday={isBookingToday}
            key={experience.id}
          />
        ))}
      </div>
    </div>
  );
}

type ExperienceDropTimesProps = {
  experience: Pick<Experience, 'name' | 'dropTimes'>;
  theme: Theme;
  nextDropTime?: ParkTime;
  isBookingToday: boolean;
};

function ExperienceDropTimes(props: ExperienceDropTimesProps) {
  const { experience, theme, nextDropTime, isBookingToday } = props;
  const dropTimes = experience.dropTimes ?? [];
  const upcoming = new Set(upcomingTimes(dropTimes));

  return (
    <div>
      <h3 className="mt-3">{experience.name}</h3>
      <ul className="flex flex-wrap gap-y-2 mt-1 leading-tight">
        {dropTimes.map(time => (
          <DropTime
            time={time}
            theme={theme}
            isNext={isBookingToday && time.equals(nextDropTime)}
            isPast={isBookingToday && !upcoming.has(time)}
            key={+time}
          />
        ))}
      </ul>
    </div>
  );
}

type DropTimeProps = {
  time: ParkTime;
  theme: Theme;
  isNext: boolean;
  isPast: boolean;
};

function dropTimeStyle({ theme, isNext, isPast }: DropTimeProps): string {
  if (isNext) {
    return `${theme.text} font-bold`;
  }

  if (isPast) {
    return 'text-gray-500';
  }

  return 'font-semibold';
}

function DropTime(props: DropTimeProps) {
  const { time, theme, isNext } = props;

  return (
    <li className="min-w-[6em] text-center">
      <div className={dropTimeStyle(props)}>
        <Time time={time} />
      </div>
      {isNext && (
        <div
          className={`rounded-xs ${theme.bg} text-white/90 text-xs font-semibold text-center uppercase`}
        >
          next
        </div>
      )}
    </li>
  );
}

function BookedDesc() {
  return (
    <Screen title={BOOKED}>
      <p>
        You currently have a Lightning Lane reservation for this attraction.
      </p>
    </Screen>
  );
}
