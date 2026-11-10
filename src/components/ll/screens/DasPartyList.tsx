import { use, useLayoutEffect } from 'react';

import { DasParty, Guest } from '@/api/das';
import { Booking, DasBooking, isDAS } from '@/api/itinerary';
import Button from '@/components/Button';
import Screen from '@/components/Screen';
import { Time } from '@/components/Time';
import NavContext from '@/contexts/NavContext';
import ParkContext from '@/contexts/ParkContext';
import PlansContext from '@/contexts/PlansContext';

import BookingDetails from './BookingDetails';
import DasSelection from './DasSelection';

const AVATAR_SIZE_PX = 36;

type DasPartyListProps = {
  parties: DasParty[];
};

type BookedParty = {
  party: DasParty;
  selection: DasBooking;
};

// Maps the primary guest of each DAS party to their current DAS selection.
function findSelectionsByGuestId(
  plans: Booking[],
  parties: DasParty[]
): Map<string, DasBooking> {
  const dasGuestIds = new Set(parties.map(party => party.primaryGuest.id));
  const selectionsByGuestId = new Map<string, DasBooking>();

  for (const selection of plans.filter(isDAS)) {
    const dasGuest = selection.guests.find(guest => dasGuestIds.has(guest.id));

    if (dasGuest) {
      selectionsByGuestId.set(dasGuest.id, selection);
    }
  }

  return selectionsByGuestId;
}

type PartyRowProps = {
  primaryGuest: Guest;
  children: React.ReactNode;
};

// A row for one DAS party, which goes by its primary guest: their picture (or
// their initial when they don't have one), then the row's content.
function PartyRow({ primaryGuest, children }: PartyRowProps) {
  return (
    <li className="row">
      <span
        className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-pressed text-sm font-semibold text-ink"
        aria-hidden="true"
      >
        {primaryGuest.avatarImageUrl ? (
          <img
            src={primaryGuest.avatarImageUrl}
            alt=""
            width={AVATAR_SIZE_PX}
            height={AVATAR_SIZE_PX}
            className="size-full object-cover"
          />
        ) : (
          primaryGuest.name[0]
        )}
      </span>
      {children}
    </li>
  );
}

type UnbookedPartiesProps = {
  parties: DasParty[];
};

function UnbookedParties({ parties }: UnbookedPartiesProps) {
  const { goTo } = use(NavContext);
  const { park } = use(ParkContext);

  if (parties.length === 0) {
    return null;
  }

  return (
    <>
      <h3>Select Next Experience</h3>
      <ul className="list mt-3">
        {parties.map(party => (
          <PartyRow
            primaryGuest={party.primaryGuest}
            key={party.primaryGuest.id}
          >
            <span className="row-title leading-tight">
              {party.primaryGuest.name}
            </span>
            <Button
              type="small"
              onClick={() => goTo(<DasSelection park={park} party={party} />)}
            >
              Select
            </Button>
          </PartyRow>
        ))}
      </ul>
    </>
  );
}

type BookedPartiesProps = {
  bookedParties: BookedParty[];
};

function BookedParties({ bookedParties }: BookedPartiesProps) {
  const { goTo } = use(NavContext);

  if (bookedParties.length === 0) {
    return null;
  }

  return (
    <>
      <h3>Current Selection</h3>
      <ul className="list mt-3">
        {bookedParties.map(({ party, selection }) => (
          <PartyRow
            primaryGuest={party.primaryGuest}
            key={party.primaryGuest.id}
          >
            <div className="row-title leading-tight">
              <div>{party.primaryGuest.name}</div>
              <div className="mt-1 text-[13px] font-normal text-muted">
                {selection.name} @ <Time time={selection.start.time} />
              </div>
            </div>
            <Button
              type="small"
              onClick={() => goTo(<BookingDetails booking={selection} />)}
            >
              Details
            </Button>
          </PartyRow>
        ))}
      </ul>
    </>
  );
}

type PartyListsProps = {
  hasParties: boolean;
  unbookedParties: DasParty[];
  bookedParties: BookedParty[];
};

function PartyLists({
  hasParties,
  unbookedParties,
  bookedParties,
}: PartyListsProps) {
  if (!hasParties) {
    return <div />;
  }

  return (
    <>
      <UnbookedParties parties={unbookedParties} />
      <BookedParties bookedParties={bookedParties} />
    </>
  );
}

// The starting point for DAS. With a single party it goes straight to that
// party's selection, or to making one; otherwise it lists the parties.
export default function DasPartyList({ parties }: DasPartyListProps) {
  const { park } = use(ParkContext);
  const { plans, refreshPlans, loaderElem } = use(PlansContext);

  useLayoutEffect(() => {
    refreshPlans();
  }, [refreshPlans]);

  const selectionsByGuestId = findSelectionsByGuestId(plans, parties);
  const [onlyParty] = parties;

  if (!loaderElem && parties.length === 1 && onlyParty) {
    const selection = selectionsByGuestId.get(onlyParty.primaryGuest.id);

    if (selection) {
      return <BookingDetails booking={selection} />;
    }

    return <DasSelection park={park} party={onlyParty} />;
  }

  const unbookedParties = parties.filter(party => {
    return !selectionsByGuestId.has(party.primaryGuest.id);
  });
  const bookedParties = parties.flatMap(party => {
    const selection = selectionsByGuestId.get(party.primaryGuest.id);

    if (!selection) {
      return [];
    }

    return {
      party,
      selection,
    };
  });

  return (
    <Screen
      title={`DAS ${parties.length === 1 ? 'Selection' : 'Parties'}`}
      theme={park.theme}
    >
      {loaderElem ?? (
        <PartyLists
          hasParties={parties.length > 0}
          unbookedParties={unbookedParties}
          bookedParties={bookedParties}
        />
      )}
    </Screen>
  );
}
