import {
  Dispatch,
  ReactNode,
  SetStateAction,
  use,
  useCallback,
  useEffect,
  useState,
} from 'react';

import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import { modifyDate, parkDate } from '@/datetime';
import kvdb from '@/kvdb';

export const BOOKING_DATE_KEY = 'bg1.date';

// How many days can be booked, counting today.
export const NUM_BOOKING_DAYS = 22;

function getBookingDates(): string[] {
  const today = parkDate();

  const daysAhead = [...Array(NUM_BOOKING_DAYS).keys()];

  return daysAhead.map(days => modifyDate(today, days));
}

// Returns the date if it can be booked, and today otherwise.
function toBookableDate(date: unknown): string {
  if (typeof date === 'string' && getBookingDates().includes(date)) {
    return date;
  }

  return parkDate();
}

type BookingDateProviderProps = {
  children: ReactNode;
};

export default function BookingDateProvider({
  children,
}: BookingDateProviderProps) {
  const { prebook: canPrebook } = use(ClientsContext).ll.rules;

  const [bookingDate, setDate] = useState(() => {
    return canPrebook
      ? toBookableDate(kvdb.getDaily(BOOKING_DATE_KEY))
      : parkDate();
  });

  useEffect(() => {
    kvdb.setDaily(BOOKING_DATE_KEY, bookingDate);
  }, [bookingDate]);

  const setBookingDate = useCallback<Dispatch<SetStateAction<string>>>(
    dateOrUpdater => {
      setDate(previousDate => {
        const date =
          typeof dateOrUpdater === 'function'
            ? dateOrUpdater(previousDate)
            : dateOrUpdater;

        return canPrebook ? toBookableDate(date) : parkDate();
      });
    },
    [canPrebook]
  );

  return (
    <BookingDateContext
      value={{
        bookingDate,
        setBookingDate,
      }}
    >
      {children}
    </BookingDateContext>
  );
}
