import { memo, use } from 'react';

import { Booking } from '@/api/itinerary';
import { Park } from '@/api/resort';
import { Day } from '@/components/Day';
import Tab from '@/components/Tab';
import PlansContext from '@/contexts/PlansContext';
import { DEFAULT_THEME } from '@/contexts/ThemeContext';
import { parkDate } from '@/datetime';

import { ScreenProps } from '../../Screen';
import BookingListing from '../BookingListing';
import NoPlans from '../NoPlans';
import RefreshButton from './RefreshButton';

type DayPlans = {
  date: string;

  // The day's plans, apart from park passes.
  plans: Booking[];

  // The parks the guest has plans in that day.
  parks: Set<Park>;
};

type PlansListProps = {
  plans: Booking[];
};

type DayPlansItemProps = {
  dayPlans: DayPlans;
};

// A plan counts toward the day's parks unless it's a Lightning Lane with a
// choice of experiences, or its park is one BG1 doesn't know (no icon).
function isTiedToPark(plan: Booking): boolean {
  const hasChoices = plan.type === 'LL' && !!plan.choices;

  return !hasChoices && !!plan.park.icon;
}

// Groups plans by park date, in the order the dates first appear. A day that
// only has a park pass is included with no plans.
function groupPlansByDate(plans: Booking[]): DayPlans[] {
  const dayPlansByDate = new Map<string, DayPlans>();

  for (const plan of plans) {
    const date = parkDate(plan.start);
    const dayPlans = dayPlansByDate.get(date) ?? {
      date,
      plans: [],
      parks: new Set(),
    };

    dayPlansByDate.set(date, dayPlans);

    if (plan.type !== 'APR') {
      dayPlans.plans.push(plan);
    }

    if (isTiedToPark(plan)) {
      dayPlans.parks.add(plan.park);
    }
  }

  return [...dayPlansByDate.values()];
}

type DayParksProps = {
  parks: Set<Park>;
};

// Names the parks the guest has plans in that day.
function DayParks({ parks }: DayParksProps) {
  return (
    <ul className="flex min-w-0 flex-wrap justify-end gap-x-2 text-[13px] text-muted empty:hidden">
      {[...parks].map(park => (
        <li
          key={park.id}
          className="not-first:before:mr-2 not-first:before:content-['·']"
          aria-label={park.name}
        >
          {park.name}
        </li>
      ))}
    </ul>
  );
}

type DayPlansListProps = {
  plans: Booking[];
};

function DayPlansList({ plans }: DayPlansListProps) {
  if (plans.length === 0) {
    return <NoPlans />;
  }

  return (
    <ul className="list">
      {plans.map(booking => (
        <li key={booking.id} data-testid="plan">
          <BookingListing details booking={booking} />
        </li>
      ))}
    </ul>
  );
}

function DayPlansItem({ dayPlans }: DayPlansItemProps) {
  const { date, plans, parks } = dayPlans;

  return (
    <li>
      <div className="sticky top-0 z-1 flex items-baseline justify-between gap-3 bg-canvas px-1 pt-5 pb-2">
        <h2 className="mt-0 text-[15px] whitespace-nowrap">
          <Day>{date}</Day>
        </h2>
        <DayParks parks={parks} />
      </div>
      <DayPlansList plans={plans} />
    </li>
  );
}

const PlansList = memo(function PlansList({ plans }: PlansListProps) {
  if (plans.length === 0) {
    return (
      <ul className="mt-4">
        <NoPlans />
      </ul>
    );
  }

  return (
    <ul>
      {groupPlansByDate(plans).map(dayPlans => (
        <DayPlansItem dayPlans={dayPlans} key={dayPlans.date} />
      ))}
    </ul>
  );
});

export default function Plans(props: Partial<ScreenProps>) {
  const { plans, refreshPlans, loaderElem } = use(PlansContext);

  return (
    <Tab
      title="Your Plans"
      buttons={<RefreshButton name="Plans" onClick={refreshPlans} />}
      theme={DEFAULT_THEME}
      {...props}
    >
      <PlansList plans={plans} />
      {loaderElem}
    </Tab>
  );
}
