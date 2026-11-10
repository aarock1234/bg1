import { use } from 'react';

import RebookingContext from '@/contexts/RebookingContext';

import Button from '../Button';
import BookingListing from './BookingListing';

export type Back<P> = Parameters<typeof Button<P>>[0]['back'];

type RebookingHeaderProps<P> = {
  // Where the Keep button navigates after it ends the modification.
  back?: Back<P>;
};

// Shows the Lightning Lane being modified, with a button to keep it instead.
export default function RebookingHeader<P>({ back }: RebookingHeaderProps<P>) {
  const rebooking = use(RebookingContext);

  if (!rebooking.current) {
    return null;
  }

  return (
    <div>
      <h2 className="section-title mt-0">Modifying Reservation</h2>
      <div className="list text-base text-ink">
        <BookingListing
          booking={rebooking.current}
          button={
            <Button type="small" back={back} onClick={rebooking.end}>
              Keep
            </Button>
          }
        />
      </div>
    </div>
  );
}
