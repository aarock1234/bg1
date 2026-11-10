import { use } from 'react';

import BookingDateContext from '@/contexts/BookingDateContext';
import NavContext from '@/contexts/NavContext';
import DayIcon from '@/icons/DayIcon';

import Button from '../Button';
import YourDay from './screens/YourDay';

type ButtonProps = Parameters<typeof Button>[0];

type YourDayButtonProps = Omit<
  ButtonProps,
  'onClick' | 'title' | 'aria-label'
> & {
  // The day to show plans for. Defaults to the date being booked for.
  date?: string;
  unmodifiable?: boolean;
};

export default function YourDayButton({
  date,
  unmodifiable,
  ...buttonProps
}: YourDayButtonProps) {
  const { goTo } = use(NavContext);
  const { bookingDate } = use(BookingDateContext);

  function showYourDay() {
    goTo(<YourDay date={date ?? bookingDate} unmodifiable={unmodifiable} />);
  }

  return (
    <Button {...buttonProps} onClick={showYourDay} aria-label="Your Day">
      <DayIcon />
    </Button>
  );
}
