import { createContext } from 'react';

import { parkDate } from '@/datetime';

interface BookingDateState {
  bookingDate: string;
  setBookingDate: React.Dispatch<React.SetStateAction<string>>;
}

export default createContext<BookingDateState>({
  bookingDate: parkDate(),
  setBookingDate: () => {},
});
