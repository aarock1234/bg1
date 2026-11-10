import { memo, use } from 'react';

import { Booking } from '@/api/itinerary';
import { Park } from '@/api/resort';
import { Day } from '@/components/Day';
import Tab from '@/components/Tab';
import PlansContext from '@/contexts/PlansContext';
import ThemeContext, { DEFAULT_THEME } from '@/contexts/ThemeContext';
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

function DayPlansItem({ dayPlans }: DayPlansItemProps) {
  const theme = use(ThemeContext);
  const { date, plans, parks } = dayPlans;

  return (
    <li>
      <div className="sticky top-0 -mx-3 pt-1 bg-white">
        <div className="flex items-center">
          <h2
            className={`flex-1 mt-0 rounded-r-full px-3 py-1 ${theme.bg} text-white text-sm uppercase`}
          >
            <Day>{date}</Day>
          </h2>
          <ul className="px-3 pl-2 text-lg text-right">
            {[...parks].map(park => (
              <li
                key={park.id}
                className="inline ml-1 first:ml-0"
                aria-label={park.name}
              >
                {park.icon}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {plans.length > 0 ? (
        <ul className="dividers">
          {plans.map(booking => (
            <li key={booking.id} data-testid="plan">
              <BookingListing details booking={booking} />
            </li>
          ))}
        </ul>
      ) : (
        <NoPlans />
      )}
    </li>
  );
}

const PlansList = memo(function PlansList({ plans }: PlansListProps) {
  if (plans.length === 0) {
    return (
      <ul>
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
