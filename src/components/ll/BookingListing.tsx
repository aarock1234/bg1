import { use } from 'react';

import { Booking } from '@/api/itinerary';
import NavContext from '@/contexts/NavContext';
import ChevronRightIcon from '@/icons/ChevronRightIcon';

import ReturnWindow from './ReturnWindow';
import BookingDetails from './screens/BookingDetails';

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

// The line under the booking's name: its boarding group or return window.
function BookingSummary({ booking }: BookingSummaryProps) {
  if (booking.type === 'BG') {
    return (
      <>
        <span>BG {booking.boardingGroup}</span>
        {booking.status === 'SUMMONED' && (
          <span className="badge badge-solid">Board Now</span>
        )}
      </>
    );
  }

  return (
    <>
      {booking.type === 'DAS' && <span className="badge">DAS</span>}
      <ReturnWindow {...booking} />
    </>
  );
}

// One plan as the row of a grouped list: its name, when it is for, and the
// actions that apply to it.
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
      className={`flex min-h-13 items-center gap-3 px-3.5 py-3 transition-colors ${details ? 'cursor-pointer active:bg-pressed' : ''}`}
      onClick={details ? showDetails : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate leading-snug font-medium">
          {booking.choices ? 'Multiple Experiences' : booking.name}
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm leading-snug whitespace-nowrap text-muted tabular-nums">
          <BookingSummary booking={booking} />
        </div>
      </div>
      {button && <div className="flex items-center gap-3">{button}</div>}
      {details && (
        <button aria-label="More Info" className="-mr-1.5 text-muted">
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}
