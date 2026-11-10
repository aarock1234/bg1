import { use } from 'react';

import { Booking } from '@/api/itinerary';
import BookingDateContext from '@/contexts/BookingDateContext';
import { parkDate } from '@/datetime';

import { Day } from '../Day';

type BookingDateProps = {
  booking?: Pick<Booking, 'start'>;
};

// Shows the park date of the booking, or the date being booked for when there
// is no booking.
export default function BookingDate({ booking }: BookingDateProps) {
  const { bookingDate } = use(BookingDateContext);

  return <Day>{booking ? parkDate(booking.start) : bookingDate}</Day>;
}
