import { use } from 'react';

import { Booking } from '@/api/itinerary';
import NavContext from '@/contexts/NavContext';
import ThemeContext from '@/contexts/ThemeContext';
import ChevronRightIcon from '@/icons/ChevronRightIcon';

import ReturnWindow from './ReturnWindow';
import BookingDetails from './screens/BookingDetails';

const DOT = <span aria-hidden>•</span>;

type BookingListingProps = {
  booking: Booking;
  button?: React.ReactNode;

  // Makes the listing open the booking's details when clicked.
  details?: boolean;
  unmodifiable?: boolean;
};

type BookingSummaryProps = {
  booking: Booking;
};

// The line above the booking's name: its boarding group or return window.
function BookingSummary({ booking }: BookingSummaryProps) {
  const theme = use(ThemeContext);

  if (booking.type === 'BG') {
    return (
      <>
        <span>BG {booking.boardingGroup}</span>
        {booking.status === 'SUMMONED' && (
          <>
            {DOT}
            <span className={`${theme.text} font-bold`}>Board Now</span>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {booking.type === 'DAS' && (
        <>
          <span>DAS</span>
          {DOT}
        </>
      )}
      <ReturnWindow {...booking} />
    </>
  );
}

export default function BookingListing({
  booking,
  button,
  details,
  unmodifiable,
}: BookingListingProps) {
  const { goTo } = use(NavContext);

  function showDetails() {
    goTo(<BookingDetails booking={booking} unmodifiable={unmodifiable} />);
  }

  return (
    <div
      className="flex items-center gap-x-3"
      onClick={details ? showDetails : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-x-2 text-gray-500 text-sm font-semibold uppercase whitespace-nowrap">
          <BookingSummary booking={booking} />
        </div>
        <div className="text-lg font-semibold leading-snug truncate">
          {booking.choices ? 'Multiple Experiences' : booking.name}
        </div>
      </div>
      {button && <div className="flex gap-x-3 items-center">{button}</div>}
      {details && (
        <button aria-label="More Info">
          <ChevronRightIcon themed />
        </button>
      )}
    </div>
  );
}
