import { use, useCallback, useEffect, useMemo, useState } from 'react';

import { isLLMP } from '@/api/itinerary';
import {
  Guest,
  Guests,
  LLMP,
  Offer,
  OfferError,
  OfferExperience,
  OfferOptions,
  ParkHours,
} from '@/api/ll';
import { ReturnTimeRange } from '@/api/ll/auto-book';
import { bookForGuests } from '@/api/ll/booking';
import FloatingButton from '@/components/FloatingButton';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';
import Spinner from '@/components/Spinner';
import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import PartyContext, { Party } from '@/contexts/PartyContext';
import PlansContext from '@/contexts/PlansContext';
import RebookingContext from '@/contexts/RebookingContext';
import ResortContext from '@/contexts/ResortContext';
import { parkDate } from '@/datetime';
import useAutoBook, { AutoBookStatus } from '@/hooks/useAutoBook';
import useDataLoader from '@/hooks/useDataLoader';
import useScreenState from '@/hooks/useScreenState';
import useWakeLock from '@/hooks/useWakeLock';
import { ping } from '@/ping';

import BookingDate from '../BookingDate';
import RebookingHeader from '../RebookingHeader';
import YourDayButton from '../YourDayButton';
import AutoBook from './BookExperience/AutoBook';
import NoEligibleGuests from './BookExperience/NoEligibleGuests';
import NoGuestsFound from './BookExperience/NoGuestsFound';
import NoReservationsAvailable from './BookExperience/NoReservationsAvailable';
import OfferDetails from './BookExperience/OfferDetails';
import BookingDetails from './BookingDetails';
import RefreshButton from './RefreshButton';

// `undefined` until an offer has been requested, and `null` once Disney has
// answered that it has none to give.
type OfferState = Offer | null | undefined;

type BookExperienceProps = {
  experience: OfferExperience;
};

type BookingPanelProps = {
  party: Party;
  offer: OfferState;
  isModifying: boolean;
  autoBook: AutoBookPanel;
  onRefreshParty: () => void;
  onOfferChange: (offer: Offer) => void;
  onBook: () => void;
};

type AutoBookPanel = {
  status: AutoBookStatus;
  parkHours?: ParkHours;
  isForToday: boolean;
  onStart: (range: ReturnTimeRange) => void;
  onStop: () => void;
};

function hasReachedExperienceLimit(guests: Guests): boolean {
  if (guests.eligible.length > 0) {
    return false;
  }

  return guests.ineligible.some(guest => {
    return guest.ineligibleReason === 'EXPERIENCE_LIMIT_REACHED';
  });
}

// Shows what the party can do next: fix its guest list, wait for
// availability, or book the offer.
function BookingPanel(props: BookingPanelProps) {
  const { party, offer, isModifying, autoBook } = props;
  const hasEligibleGuests = party.eligible.length > 0;
  const hasGuests = hasEligibleGuests || party.ineligible.length > 0;
  const isAutoBooking = autoBook.status.kind === 'searching';

  if (!hasGuests) {
    return <NoGuestsFound onRefresh={props.onRefreshParty} />;
  }

  if (!hasEligibleGuests) {
    return <NoEligibleGuests />;
  }

  if (offer === undefined) {
    return <div />;
  }

  if (offer === null) {
    return (
      <>
        <NoReservationsAvailable />
        <AutoBook {...autoBook} />
      </>
    );
  }

  return (
    <>
      <OfferDetails offer={offer} onOfferChange={props.onOfferChange} />
      <AutoBook {...autoBook} />
      {!isAutoBooking && (
        <FloatingButton onClick={props.onBook}>
          {isModifying ? 'Modify Lightning Lane' : 'Book Lightning Lane'}
        </FloatingButton>
      )}
    </>
  );
}

export default function BookExperience({ experience }: BookExperienceProps) {
  const { goTo } = use(NavContext);
  const { isActiveScreen } = useScreenState();
  const resort = use(ResortContext);
  const { ll } = use(ClientsContext);
  const { plans, plansLoaded, refreshPlans } = use(PlansContext);
  const { bookingDate } = use(BookingDateContext);
  const rebooking = use(RebookingContext);
  const [guests, setGuests] = useState<Guests>();
  const [selected, setSelected] = useState<Guest[]>([]);
  const [offer, setOffer] = useState<OfferState>();
  const [parkHours, setParkHours] = useState<ParkHours>();
  const { loadData, loaderElem } = useDataLoader();

  const existingBooking = rebooking.current;
  const offerDate = existingBooking ? existingBooking.start.date : bookingDate;
  const offerOptions = useMemo<OfferOptions<LLMP | undefined>>(() => {
    if (existingBooking) {
      return {
        booking: existingBooking,
      };
    }

    return {
      date: bookingDate,
    };
  }, [existingBooking, bookingDate]);

  function finishBooking(booking: LLMP): void {
    rebooking.end();
    goTo(<BookingDetails booking={booking} isNew={true} />, {
      replace: true,
    });
    refreshPlans();
    ping(resort, 'G');
  }

  const autoBook = useAutoBook({
    onBooked: finishBooking,
  });
  const { stop: stopAutoBook } = autoBook;
  const isAutoBooking = autoBook.status.kind === 'searching';

  useWakeLock(isAutoBooking);

  // Auto booking only runs while the guest is looking at this screen.
  useEffect(() => {
    if (!isActiveScreen) {
      stopAutoBook();
    }
  }, [isActiveScreen, stopAutoBook]);

  // Another screen may have replaced the offer while this one was in the
  // background, in which case a fresh one is needed.
  useEffect(() => {
    if (!isActiveScreen) {
      return;
    }

    setOffer(currentOffer => {
      const isLatestOffer = currentOffer?.id === ll.lastOffer?.id;

      return isLatestOffer ? currentOffer : undefined;
    });
  }, [isActiveScreen, ll]);

  // Starting or ending a modification changes who can book and what can be
  // offered, so both are loaded again. A modification this screen started on
  // its own ends when the screen closes.
  useEffect(() => {
    setGuests(undefined);
    setOffer(undefined);

    if (rebooking.auto) {
      return rebooking.end;
    }
  }, [rebooking]);

  // Deselecting guests keeps the current offer, which still covers everyone
  // who remains. Adding a guest, or having no offer at all, needs a new one.
  const selectGuests = useCallback(
    (newSelection: Guest[]) => {
      const selectedIds = new Set(selected.map(guest => guest.id));
      const hasNewGuest = newSelection.some(guest => {
        return !selectedIds.has(guest.id);
      });

      setSelected(newSelection);
      setOffer(currentOffer => {
        const needsNewOffer = currentOffer === null || hasNewGuest;

        return needsNewOffer ? undefined : currentOffer;
      });
    },
    [selected]
  );

  const party = useMemo<Party | undefined>(() => {
    if (!guests) {
      return undefined;
    }

    return {
      ...guests,
      selected,
      setSelected: selectGuests,
      experience,
    };
  }, [guests, selected, selectGuests, experience]);

  const loadParty = useCallback(() => {
    loadData(async () => {
      const partyGuests: Guests = existingBooking
        ? {
            eligible: existingBooking.guests,
            ineligible: [],
          }
        : await ll.guests(experience, bookingDate);

      // When everyone has already booked this experience, the only thing left
      // to do is modify that booking, so do it without being asked.
      if (hasReachedExperienceLimit(partyGuests)) {
        const [bookingToModify, ...otherBookings] = plans
          .filter(isLLMP)
          .filter(booking => {
            return (
              booking.experience.id === experience.id &&
              !!booking.modifiable &&
              parkDate(booking.start) === bookingDate
            );
          });

        if (bookingToModify && otherBookings.length === 0) {
          rebooking.begin(bookingToModify, true);
          return;
        }
      }

      setGuests(partyGuests);
      setSelected(partyGuests.eligible.slice(0, ll.rules.maxPartySize));
    });
  }, [
    plans,
    ll,
    experience,
    bookingDate,
    existingBooking,
    rebooking,
    loadData,
  ]);

  useEffect(() => {
    if (!guests && plansLoaded) {
      loadParty();
    }
  }, [guests, plansLoaded, loadParty]);

  const refreshOffer = useCallback(
    (isFirstOffer = false) => {
      if (!guests || selected.length === 0) {
        return;
      }

      // Disney reports who an offer can and can't include, which replaces
      // what was known about the party.
      function updateParty(offerGuests: Guests): void {
        setGuests(offerGuests);
        setSelected(offerGuests.eligible);
      }

      loadData(
        async () => {
          try {
            const newOffer = await ll.offer(experience, selected, offerOptions);

            // A change is only worth pointing out when the guest didn't ask
            // for a new offer themselves.
            if (!isFirstOffer) {
              newOffer.changed = false;
            }

            setOffer(newOffer);

            if (newOffer.parkHours) {
              setParkHours(newOffer.parkHours);
            }

            if (newOffer.guests.ineligible.length > 0) {
              updateParty(newOffer.guests);
            }
          } catch (error) {
            setOffer(currentOffer => currentOffer ?? null);

            if (error instanceof OfferError) {
              updateParty(error.guests);
              return;
            }

            throw error;
          }
        },
        {
          messages: {
            410: isFirstOffer ? '' : 'No reservations available',
          },
        }
      );
    },
    [ll, experience, guests, selected, offerOptions, loadData]
  );

  useEffect(() => {
    if (offer === undefined) {
      refreshOffer(true);
    }
  }, [offer, refreshOffer]);

  async function book(): Promise<void> {
    if (!offer) {
      return;
    }

    const booking = await loadData(() => bookForGuests(ll, offer, selected), {
      messages: {
        410: 'Offer expired',
      },
    });

    if (booking) {
      finishBooking(booking);
    }
  }

  function startAutoBook(range: ReturnTimeRange): void {
    if (selected.length === 0) {
      return;
    }

    autoBook.start({
      ll,
      experience,
      guests: selected,
      range,
      offerOptions,
    });
  }

  // Auto booking requests offers of its own, so the one on screen is stale.
  function stopAutoBookAndRefresh(): void {
    stopAutoBook();
    setOffer(undefined);
  }

  // With nobody eligible there is no offer to refresh, only the party.
  const hasNoEligibleGuests = guests?.eligible.length === 0;

  function refresh(): void {
    if (hasNoEligibleGuests) {
      loadParty();
    } else {
      refreshOffer();
    }
  }

  return (
    <Screen
      title="Lightning Lane"
      theme={experience.park.theme}
      buttons={
        <>
          <YourDayButton />
          <RefreshButton
            onClick={refresh}
            name={hasNoEligibleGuests ? 'Party' : 'Offer'}
          />
        </>
      }
      subhead={
        <>
          <RebookingHeader back={rebooking.auto} />
          <BookingDate booking={offer ?? undefined} />
        </>
      }
    >
      <h2>{experience.name}</h2>
      <LandLine land={experience.land} />
      {party && (
        <PartyContext value={party}>
          <BookingPanel
            party={party}
            offer={offer}
            isModifying={!!existingBooking}
            autoBook={{
              status: autoBook.status,
              parkHours,
              isForToday: offerDate === parkDate(),
              onStart: startAutoBook,
              onStop: stopAutoBookAndRefresh,
            }}
            onRefreshParty={loadParty}
            onOfferChange={setOffer}
            onBook={book}
          />
        </PartyContext>
      )}
      {!party && !plansLoaded && <Spinner />}
      {loaderElem}
    </Screen>
  );
}
