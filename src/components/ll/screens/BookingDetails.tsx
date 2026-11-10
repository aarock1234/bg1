import { use, useState } from 'react';

import { DasParty } from '@/api/das';
import {
  BoardingGroup,
  Booking,
  DasBooking,
  EntitledGuest,
  LLMP,
  LightningLane,
  isDAS,
  isLLMP,
} from '@/api/itinerary';
import { Park } from '@/api/resort';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import { Day } from '@/components/Day';
import FloatingButton from '@/components/FloatingButton';
import GuestList, { InfoById } from '@/components/GuestList';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import DasPartiesContext from '@/contexts/DasPartiesContext';
import NavContext from '@/contexts/NavContext';
import ResortContext from '@/contexts/ResortContext';
import { parkDate } from '@/datetime';

import { ExperienceList } from '../ExperienceList';
import ModifyButton from '../ModifyButton';
import { ReturnTimeCard } from '../ReturnTime';
import CancelGuests from './CancelGuests';
import ChangeBookingTime from './ChangeBookingTime';
import Home from './Home';

const TITLES: Record<Booking['type'], string> = {
  LL: 'Lightning Lane',
  DAS: 'DAS Selection',
  BG: 'Boarding Group',
  APR: 'Park Pass',
  RES: 'Reservation',
};

type Choice = NonNullable<Booking['choices']>[number];

type ParkChoices = {
  park: Park;
  experiences: Choice[];
};

type BookingDetailsProps = {
  booking: Booking;
  isNew?: boolean;
  unmodifiable?: boolean;
};

// Groups the experiences a Lightning Lane can be redeemed at by park, with the
// booking's own park first. Parks without any choices are left out.
function groupChoicesByPark(booking: Booking, parks: Park[]): ParkChoices[] {
  const choicesByPark = new Map<Park, Choice[]>();

  for (const park of [booking.park, ...parks]) {
    choicesByPark.set(park, []);
  }

  for (const choice of booking.choices ?? []) {
    choicesByPark.get(choice.park)?.push(choice);
  }

  return [...choicesByPark]
    .filter(([, experiences]) => experiences.length > 0)
    .map(([park, experiences]) => {
      return {
        park,
        experiences,
      };
    });
}

// Returns the guest on a DAS booking who is the primary guest of one of the
// user's DAS parties. Without one, the booking's guests can't be cancelled.
function findDasGuest(
  booking: Booking,
  dasParties: DasParty[]
): EntitledGuest | undefined {
  if (!isDAS(booking)) {
    return undefined;
  }

  return booking.guests.find(guest => {
    return dasParties.some(party => party.primaryGuest.id === guest.id);
  });
}

// Lists how many redemptions each guest has left, for guests whose Lightning
// Lane isn't the usual single redemption.
function redemptionsLeftByGuestId(booking: Booking): InfoById {
  if (booking.type !== 'LL') {
    return {};
  }

  const guestsWithUnusualCount = booking.guests.filter(guest => {
    return (guest.redemptions ?? 1) !== 1;
  });

  return Object.fromEntries(
    guestsWithUnusualCount.map(guest => {
      return [guest.id, `Redemptions left: ${guest.redemptions}`];
    })
  );
}

type BoardingGroupInfoProps = {
  booking: BoardingGroup;
};

function BoardingGroupInfo({ booking }: BoardingGroupInfoProps) {
  return (
    <>
      {booking.status === 'SUMMONED' && <Alert title="Boarding Group Called" />}
      <div className="card mt-4 py-3">
        <h3 className="mt-0 text-[13px] font-normal tracking-normal text-muted">
          Boarding Group:{' '}
          <span className="mt-0.5 block text-[17px] font-semibold text-ink tabular-nums">
            {booking.boardingGroup}
          </span>
        </h3>
        <p className="note mt-2 mb-0">
          Check the official Disney app for return time and other virtual queue
          information.
        </p>
      </div>
    </>
  );
}

type ChangeTimeButtonProps = {
  booking: LLMP;
};

function ChangeTimeButton({ booking }: ChangeTimeButtonProps) {
  const { goTo } = use(NavContext);

  function changeBookingTime() {
    goTo(<ChangeBookingTime booking={booking} />);
  }

  return (
    <Button type="small" onClick={changeBookingTime}>
      Change
    </Button>
  );
}

type ReplacementChoicesProps = {
  // The name of the experience that was originally booked, if known.
  originalName: string;
  parkChoices: ParkChoices[];
};

function ReplacementChoices({
  originalName,
  parkChoices,
}: ReplacementChoicesProps) {
  return (
    <>
      <p className="note mt-4 px-1">
        {originalName && (
          <>
            <b className="text-ink">{originalName}</b> was temporarily
            unavailable during your return time.{' '}
          </>
        )}
        You may redeem this Lightning Lane at one of these replacement
        experiences:
      </p>
      {parkChoices.map(({ park, experiences }) => (
        <ExperienceList
          heading={park.name}
          experiences={experiences}
          key={park.id}
        />
      ))}
    </>
  );
}

export default function BookingDetails({
  booking,
  isNew,
  unmodifiable,
}: BookingDetailsProps) {
  const { goTo, goBack } = use(NavContext);
  const { parks } = use(ResortContext);
  const { ll } = use(ClientsContext);
  const dasParties = use(DasPartiesContext);

  const dasGuest = findDasGuest(booking, dasParties);
  const canCancelGuests =
    !!booking.cancellable && (booking.type !== 'DAS' || !!dasGuest);

  // The guests still on the booking, tracked only when they can be cancelled.
  const [remainingGuests, setRemainingGuests] = useState(
    canCancelGuests ? booking.guests : undefined
  );

  const hasChoices = !!booking.choices;
  const parkChoices = groupChoicesByPark(booking, parks);
  const canChangeTime =
    isLLMP(booking) &&
    !unmodifiable &&
    ll.rules.timeSelect &&
    booking.modifiable;

  function updateRemainingGuests(guests: EntitledGuest[]) {
    if (guests.length > 0) {
      setRemainingGuests(guests);
    } else {
      goBack();
    }
  }

  function showCancelGuests(
    cancellableBooking: LightningLane | DasBooking,
    guests: EntitledGuest[]
  ) {
    goTo(
      <CancelGuests
        booking={{
          ...cancellableBooking,
          guests,
        }}
        dasGuest={dasGuest}
        onCancel={updateRemainingGuests}
      />
    );
  }

  function showPlans() {
    return goBack({
      screen: Home,
      props: {
        tabName: 'Plans',
      },
    });
  }

  return (
    <Screen
      title={`Your ${TITLES[booking.type]}`}
      buttons={!unmodifiable && !isNew && <ModifyButton booking={booking} />}
      subhead={<Day>{parkDate(booking.start)}</Day>}
    >
      {hasChoices ? (
        <h2 className="mt-5">Multiple Experiences</h2>
      ) : (
        <>
          <h2 className="mt-5">{booking.name}</h2>
          {booking.land && <LandLine land={booking.land} />}
        </>
      )}
      {booking.type === 'BG' ? (
        <BoardingGroupInfo booking={booking} />
      ) : (
        <ReturnTimeCard
          start={booking.start}
          end={booking.end}
          button={canChangeTime && <ChangeTimeButton booking={booking} />}
        />
      )}
      {hasChoices && (
        <ReplacementChoices
          originalName={booking.name}
          parkChoices={parkChoices}
        />
      )}
      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="mt-0">Your Party</h3>
        {booking.cancellable && remainingGuests && (
          <Button
            type="small"
            onClick={() => showCancelGuests(booking, remainingGuests)}
          >
            Cancel
          </Button>
        )}
      </div>
      <GuestList
        guests={remainingGuests ?? booking.guests}
        conflicts={redemptionsLeftByGuestId(booking)}
      />
      {isNew && <FloatingButton onClick={showPlans}>Show Plans</FloatingButton>}
    </Screen>
  );
}
