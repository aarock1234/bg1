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
    <li>
      <div className="font-semibold">
        <ReturnWindow {...plan} />
      </div>
      <div className="text-lg">{plan.name}</div>
      {plan.type === 'LL' && plan.showTimeInfo && (
        <div className="">
          Show Time:{' '}
          <b>
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
      <ul className="dividers divide-yellow-400/50 -my-3 px-4">
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
