import { use, useCallback, useEffect, useState } from 'react';

import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import { modifyDate, parkDate } from '@/datetime';
import kvdb from '@/kvdb';

export const BOOKING_DATE_KEY = 'bg1.date';
export const NUM_BOOKING_DAYS = 22;

function getBookingDates() {
  const today = parkDate();
  return [...Array(NUM_BOOKING_DAYS).keys()].map(i => modifyDate(today, i));
}

function validDate(date: string | void) {
  return date && getBookingDates().includes(date) ? date : parkDate();
}

export default function BookingDateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { prebook } = use(ClientsContext).ll.rules;
  const [bookingDate, setDate] = useState(() => {
    return prebook
      ? validDate(kvdb.getDaily<string>(BOOKING_DATE_KEY))
      : parkDate();
  });

  useEffect(() => {
    kvdb.setDaily<string>(BOOKING_DATE_KEY, bookingDate);
  }, [bookingDate]);

  const setBookingDate = useCallback(
    (date: Parameters<typeof setDate>[0]) => {
      setDate(prevDate => {
        date = typeof date === 'function' ? date(prevDate) : date;
        return prebook ? validDate(date) : parkDate();
      });
    },
    [prebook, setDate]
  );

  useEffect(() => {
    kvdb.setDaily<string>(BOOKING_DATE_KEY, bookingDate);
  }, [bookingDate]);

  return (
    <BookingDateContext value={{ bookingDate, setBookingDate }}>
      {children}
    </BookingDateContext>
  );
}
