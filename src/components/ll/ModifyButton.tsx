import { use } from 'react';

import { Booking, LLMP, isLLMP } from '@/api/itinerary';
import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext, { NavError } from '@/contexts/NavContext';
import ParkContext from '@/contexts/ParkContext';
import RebookingContext from '@/contexts/RebookingContext';
import { parkDate } from '@/datetime';

import Button from '../Button';
import BookExperience from './screens/BookExperience';
import Home from './screens/Home';

type ModifyButtonProps = Parameters<typeof Button>[0] & {
  booking: Booking;
};

// Starts modifying a Lightning Lane and takes the guest to where they pick its
// replacement. Renders nothing for a booking that can't be modified.
export default function ModifyButton({
  booking,
  ...buttonProps
}: ModifyButtonProps) {
  const { ll } = use(ClientsContext);
  const { goBack } = use(NavContext);
  const { park, setPark } = use(ParkContext);
  const { setBookingDate } = use(BookingDateContext);
  const rebooking = use(RebookingContext);

  if (!booking.modifiable || rebooking.auto || !isLLMP(booking)) {
    return null;
  }

  function goHome() {
    return goBack({
      screen: Home,
      props: {
        tabName: 'LL',
      },
    });
  }

  async function goToBookExperience() {
    try {
      await goBack({
        screen: BookExperience,
      });
    } catch (error) {
      if (!(error instanceof NavError)) {
        throw error;
      }

      await goHome();
    }
  }

  async function beginModifying(lightningLane: LLMP) {
    const today = parkDate();
    const newDate = parkDate(lightningLane.start);
    const mustStayInSamePark = !ll.rules.parkModify || newDate > today;

    rebooking.begin(lightningLane);
    setBookingDate(newDate);

    if (mustStayInSamePark) {
      setPark(lightningLane.park);

      if (park !== lightningLane.park) {
        await goHome();

        return;
      }
    }

    await goToBookExperience();
  }

  return (
    <Button {...buttonProps} onClick={() => beginModifying(booking)}>
      Modify
    </Button>
  );
}
