import { Dispatch, SetStateAction, createContext } from 'react';

import { parkDate } from '@/datetime';

type BookingDateState = {
  bookingDate: string;
  setBookingDate: Dispatch<SetStateAction<string>>;
};

export default createContext<BookingDateState>({
  bookingDate: parkDate(),
  setBookingDate: () => undefined,
});
