import { use } from 'react';

import { Booking } from '@/api/itinerary';
import { Offer } from '@/api/ll';
import PlansContext from '@/contexts/PlansContext';

import Alert from '../Alert';
import { Time } from '../Time';
import ReturnWindow from './ReturnWindow';

type OverlappingPlansProps = {
  offer: Pick<Offer, 'start' | 'end' | 'itinerary'>;
};

type OverlappedPlanProps = {
  plan: Booking;
};

// Returns the plans whose time overlaps the offer's return time more than
// Disney recommends.
function findOverlappedPlans(
  offer: OverlappingPlansProps['offer'],
  plans: Booking[]
): Booking[] {
  const overlappedItems = offer.itinerary.filter(item => {
    return item.overlap.contains(offer.start.time);
  });

  return overlappedItems.flatMap(item => {
    const plan = plans.find(plan => {
      return (
        plan.facilityId === item.facilityId &&
        !!plan.start.time?.equals(item.startTime)
      );
    });

    return plan ?? [];
  });
}

function OverlappedPlan({ plan }: OverlappedPlanProps) {
  return (
    <li className="py-2.5">
      <div className="text-[15px] font-medium text-ink">{plan.name}</div>
      <div className="mt-0.5">
        <ReturnWindow {...plan} />
      </div>
      {plan.type === 'LL' && plan.showTimeInfo && (
        <div className="mt-0.5">
          Show Time:{' '}
          <b className="font-medium text-ink">
            <Time time={plan.showTimeInfo.showStartTime} /> -{' '}
            <Time time={plan.showTimeInfo.showEndTime} />
          </b>
        </div>
      )}
    </li>
  );
}

export default function OverlappingPlans({ offer }: OverlappingPlansProps) {
  const { plans } = use(PlansContext);
  const overlappedPlans = findOverlappedPlans(offer, plans);

  if (overlappedPlans.length === 0) {
    return null;
  }

  return (
    <Alert title="Overlapping Plans">
      <p>
        This return time overlaps with your existing plans more than is
        recommended:
      </p>
      <ul className="divide-y divide-line border-y border-line">
        {overlappedPlans.map(plan => (
          <OverlappedPlan plan={plan} key={plan.id} />
        ))}
      </ul>
      <p>
        Consider selecting a different time so you don't miss out on any of your
        reservations.
      </p>
    </Alert>
  );
}
