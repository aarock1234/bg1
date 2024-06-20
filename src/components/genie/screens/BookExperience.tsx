import { useCallback, useEffect, useState } from 'react';
import { useWakeLock } from 'react-screen-wake-lock';

import { Guest, LightningLane, Offer, PlusExperience } from '@/api/genie';
import Screen from '@/components/Screen';
import { useNav } from '@/contexts/Nav';
import { Party, PartyProvider } from '@/contexts/Party';
import { usePlans } from '@/contexts/Plans';
import { useRebooking } from '@/contexts/Rebooking';
import { useResort } from '@/contexts/Resort';
import { timeToDate } from '@/datetime';
import useDataLoader from '@/hooks/useDataLoader';
import { ping } from '@/ping';

import PlansButton from '../PlansButton';
import RebookingHeader from '../RebookingHeader';
import AutoBook from './BookExperience/AutoBook';
import NoEligibleGuests from './BookExperience/NoEligibleGuests';
import NoGuestsFound from './BookExperience/NoGuestsFound';
import NoReservationsAvailable from './BookExperience/NoReservationsAvailable';
import OfferDetails from './BookExperience/OfferDetails';
import Prebooking from './BookExperience/Prebooking';
import BookingDetails from './BookingDetails';
import RefreshButton from './RefreshButton';

export default function BookExperience({
  experience,
}: {
  experience: PlusExperience;
}) {
  const { request: requestWakeLock } = useWakeLock({
    onError: error => {
      console.error(`error requesting wake lock: ${error}`);
    },
  });
  const { goTo } = useNav();
  const resort = useResort();
  const { genie } = resort;
  const { refreshPlans } = usePlans();
  const rebooking = useRebooking();
  const [party, setParty] = useState<Party>();
  const [prebooking, setPrebooking] = useState(
    !experience.flex.available &&
      experience.flex.enrollmentStartTime !== undefined
  );
  setPrebooking(false);
  const [offer, setOffer] = useState<Offer | null | undefined>(
    prebooking ? null : undefined
  );
  const { loadData, loaderElem } = useDataLoader();

  async function book(newOffer?: Offer) {
    if (!offer || !party) return;
    if (newOffer) setOffer(newOffer);
    loadData(
      async () => {
        let booking: LightningLane | null = null;
        booking = await genie.book(offer, rebooking.current, party.selected);
        rebooking.end();
        const selectedIds = new Set(party.selected.map(g => g.id));
        const guestsToCancel = booking.guests.filter(
          g => !selectedIds.has(g.id)
        );
        if (guestsToCancel.length > 0) {
          await genie.cancelBooking(guestsToCancel);
          booking.guests = booking.guests.filter(g => selectedIds.has(g.id));
        }
        if (booking) {
          goTo(<BookingDetails booking={booking} isNew={true} />, {
            replace: true,
          });
        }
        refreshPlans();
        ping(resort, 'G');
      },
      {
        messages: { 410: 'Offer expired' },
      }
    );
  }

  function checkAvailability() {
    loadData(async flash => {
      const exps = await genie.experiences(experience.park);
      const exp = exps.find(exp => exp.id === experience.id);
      if (exp?.flex?.available) {
        setPrebooking(false);
        setOffer(undefined);
      } else {
        flash('Reservations not open yet');
      }
    });
  }

  const loadParty = useCallback(() => {
    loadData(async () => {
      const guests = rebooking.current
        ? { eligible: rebooking.current.guests, ineligible: [] }
        : await genie.guests(experience);
      setParty({
        ...guests,
        selected: guests.eligible.slice(0, genie.maxPartySize),
        setSelected: (selected: Guest[]) =>
          setParty(party => {
            if (!party) return party;
            const oldSelected = new Set(party.selected);
            setPrebooking(prebooking => {
              if (!prebooking) {
                setOffer(offer =>
                  offer === null || selected.some(g => !oldSelected.has(g))
                    ? undefined
                    : offer
                );
              }
              return prebooking;
            });
            return { ...party, selected };
          }),
        experience,
      });
    });
  }, [genie, experience, rebooking, loadData]);

  useEffect(() => {
    if (!party) loadParty();
  }, [party, loadParty]);

  const refreshOffer = useCallback(
    async (event?: React.MouseEvent<HTMLButtonElement>): Promise<Offer> => {
      if (!party || party.selected.length === 0) return undefined!;
      let newOffer: Offer | undefined = undefined;
      loadData(
        async () => {
          try {
            newOffer = await genie.offer(
              experience,
              party.selected,
              rebooking.current
            );
            const { ineligible } = newOffer.guests;
            if (ineligible.length > 0) {
              const ineligibleIds = new Set(ineligible.map(g => g.id));
              const isEligible = (g: Guest) => !ineligibleIds.has(g.id);
              setParty({
                ...party,
                eligible: party.eligible.filter(isEligible),
                ineligible: [...ineligible, ...party.ineligible],
                selected: party.selected.filter(isEligible),
              });
            }
            if (newOffer.active) {
              // If the user is intentionally refreshing, we don't need to warn
              // them that the offer has changed
              if (offer) newOffer.changed = false;
              setOffer(newOffer);
            } else {
              setOffer(offer => offer ?? null);
            }
          } catch (error) {
            if (!event) setOffer(null);
            throw error;
          }
        },
        {
          messages: { 410: offer ? 'No reservations available' : '' },
        }
      );

      return newOffer!;
    },
    [genie, experience, party, offer, rebooking, loadData]
  );

  const bookBetweenTime = useCallback(
    async (minStartTime: string, maxStartTime: string) => {
      if (!party) return;

      const newOffer = await refreshOffer();
      if (!newOffer) return;

      const minDate = timeToDate(minStartTime);
      const maxDate = timeToDate(maxStartTime);
      const offerDate = timeToDate(newOffer.start.time);

      if (offerDate >= minDate && offerDate <= maxDate) {
        await book(newOffer);
      }
    },
    [genie, goTo, offer, party, rebooking, refreshPlans]
  );

  useEffect(() => {
    if (offer === undefined) refreshOffer();
  }, [offer, refreshOffer]);

  const noEligible = party?.eligible.length === 0;
  const noGuestsFound = noEligible && party?.ineligible.length === 0;

  useEffect(() => {
    requestWakeLock();
  }, []);

  return (
    <Screen
      title="Lightning Lane"
      theme={experience.park.theme}
      buttons={
        <>
          <PlansButton />
          {!prebooking && (
            <RefreshButton
              onClick={() => {
                if (noEligible) {
                  loadParty();
                } else {
                  refreshOffer();
                }
              }}
              name={noEligible ? 'Party' : 'Offer'}
            />
          )}
        </>
      }
      subhead={<RebookingHeader />}
    >
      <h2>{experience.name}</h2>
      <div>{experience.park.name}</div>
      {party && (
        <PartyProvider value={party}>
          {prebooking && party ? (
            <Prebooking
              startTime={experience.flex.enrollmentStartTime}
              onRefresh={checkAvailability}
            />
          ) : noGuestsFound ? (
            <NoGuestsFound onRefresh={loadParty} />
          ) : noEligible ? (
            <NoEligibleGuests />
          ) : !party || offer === undefined ? (
            <div />
          ) : offer === null ? (
            <>
              <NoReservationsAvailable />
              <AutoBook onBook={bookBetweenTime} />
            </>
          ) : (
            <>
              <OfferDetails offer={offer} onBook={book} />
              <AutoBook onBook={bookBetweenTime} />
            </>
          )}
        </PartyProvider>
      )}
      {loaderElem}
    </Screen>
  );
}
