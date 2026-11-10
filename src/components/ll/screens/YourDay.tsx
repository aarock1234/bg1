import { use } from 'react';

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

// Lists the guest's plans for one park day.
export default function YourDay({ date, unmodifiable }: YourDayProps) {
  const { plans } = use(PlansContext);

  const dayPlans = plans.filter(plan => parkDate(plan.start) === date);
  const listedPlans = dayPlans.filter(plan => plan.type !== 'APR');
  const [firstPlan] = dayPlans;

  return (
    <Screen
      title="Your Day"
      subhead={<Day>{date}</Day>}
      theme={firstPlan?.park.theme}
    >
      {listedPlans.length > 0 ? (
        <ul className="dividers">
          {listedPlans.map(plan => (
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
      ) : (
        <NoPlans />
      )}
    </Screen>
  );
}
