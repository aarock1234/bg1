import { use } from 'react';

import { Booking } from '@/api/itinerary';
import { Day } from '@/components/Day';
import Screen from '@/components/Screen';
import PlansContext from '@/contexts/PlansContext';
import { parkDate } from '@/datetime';

import BookingListing from '../BookingListing';
import ModifyButton from '../ModifyButton';
import NoPlans from '../NoPlans';

type YourDayProps = {
  date: string;
  unmodifiable?: boolean;
};

type DayPlansProps = {
  plans: Booking[];
  unmodifiable?: boolean;
};

function DayPlans({ plans, unmodifiable }: DayPlansProps) {
  if (plans.length === 0) {
    return <NoPlans />;
  }

  return (
    <ul className="list">
      {plans.map(plan => (
        <li key={plan.id}>
          <BookingListing
            details
            booking={plan}
            button={
              !unmodifiable && <ModifyButton booking={plan} type="small" />
            }
            unmodifiable={unmodifiable}
          />
        </li>
      ))}
    </ul>
  );
}

// Lists the guest's plans for one park day.
export default function YourDay({ date, unmodifiable }: YourDayProps) {
  const { plans } = use(PlansContext);

  const dayPlans = plans.filter(plan => parkDate(plan.start) === date);
  const listedPlans = dayPlans.filter(plan => plan.type !== 'APR');

  return (
    <Screen title="Your Day" subhead={<Day>{date}</Day>}>
      <div className="mt-4">
        <DayPlans plans={listedPlans} unmodifiable={unmodifiable} />
      </div>
    </Screen>
  );
}
