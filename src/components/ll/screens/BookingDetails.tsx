import { use, useState } from 'react';

import { DasParty } from '@/api/das';
import {
  BoardingGroup,
  Booking,
  EntitledGuest,
  LLMP,
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
import { DEFAULT_THEME, Theme } from '@/contexts/ThemeContext';
import { parkDate } from '@/datetime';

import { ExperienceList } from '../ExperienceList';
import ModifyButton from '../ModifyButton';
import ReturnTime from '../ReturnTime';
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

// A booking with choices takes a park's theme only when every choice is in
// that one park.
function screenTheme(booking: Booking, parkChoices: ParkChoices[]): Theme {
  if (!booking.choices) {
    return booking.park.theme;
  }

  const [firstParkChoices] = parkChoices;

  if (parkChoices.length === 1 && firstParkChoices) {
    return firstParkChoices.park.theme;
  }

  return DEFAULT_THEME;
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
      <h3>
        Boarding Group:{' '}
        <span className="ml-1 font-semibold">{booking.boardingGroup}</span>
      </h3>
      <p>
        Check the official Disney app for return time and other virtual queue
        information.
      </p>
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
      <p>
        {originalName && (
          <>
            <b>{originalName}</b> was temporarily unavailable during your return
            time.{' '}
          </>
        )}
        You may redeem this Lightning Lane at one of these replacement
        experiences:
      </p>
      {parkChoices.map(({ park, experiences }) => (
        <ExperienceList
          heading={park.name}
          experiences={experiences}
          bg={park.theme.bg}
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
      theme={screenTheme(booking, parkChoices)}
      buttons={!unmodifiable && !isNew && <ModifyButton booking={booking} />}
      subhead={<Day>{parkDate(booking.start)}</Day>}
    >
      {hasChoices ? (
        <h2>Multiple Experiences</h2>
      ) : (
        <>
          <h2>{booking.name}</h2>
          {booking.land && <LandLine land={booking.land} />}
        </>
      )}
      {booking.type === 'BG' ? (
        <BoardingGroupInfo booking={booking} />
      ) : (
        <ReturnTime
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
      <div className="flex mt-4">
        <h3 className="inline mt-0">Your Party</h3>
        {booking.cancellable && remainingGuests && (
          <Button
            type="small"
            onClick={() => {
              goTo(
                <CancelGuests
                  booking={{
                    ...booking,
                    guests: remainingGuests,
                  }}
                  dasGuest={dasGuest}
                  onCancel={updateRemainingGuests}
                />
              );
            }}
            className="ml-3"
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
