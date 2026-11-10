import { JSX } from 'react';

import { Booking, LLMP, isLLMP } from '@/api/itinerary';
import { FlexExperience, Offer } from '@/api/ll';
import { Park } from '@/api/resort';
import BookExperience from '@/components/ll/screens/BookExperience';
import BookNewReturnTime from '@/components/ll/screens/BookNewReturnTime';
import BookingDetails from '@/components/ll/screens/BookingDetails';
import CancelGuests from '@/components/ll/screens/CancelGuests';
import ChangeBookingTime from '@/components/ll/screens/ChangeBookingTime';
import DasExperienceList from '@/components/ll/screens/DasExperienceList';
import DasPartyList from '@/components/ll/screens/DasPartyList';
import DasSelection from '@/components/ll/screens/DasSelection';
import ModifyParty from '@/components/ll/screens/ModifyParty';
import PartySelector from '@/components/ll/screens/PartySelector';
import SelectReturnTime from '@/components/ll/screens/SelectReturnTime';
import YourDay from '@/components/ll/screens/YourDay';
import { Clients } from '@/contexts/ClientsContext';
import { parkDate } from '@/datetime';

import { PreviewWorld } from './clients';
import { liveExperiences } from './data/experiences';
import { experiencesIn } from './resort';

// What a screen can be built from.
export type OpenContext = {
  world: PreviewWorld;
  clients: Clients;
  park: Park;

  // The `id` option: which experience or plan the screen is for.
  id: string | undefined;
};

type ScreenOpener = (context: OpenContext) => Promise<JSX.Element>;

function isFlexExperience(
  experience: ReturnType<typeof liveExperiences>[number]
): experience is FlexExperience {
  return !!experience.flex;
}

// Returns the experience with the requested ID, or the first one that has a
// Lightning Lane return time.
function findExperience({ world, park, id }: OpenContext): FlexExperience {
  const experiences = liveExperiences(
    experiencesIn(world.previewResort, park),
    park
  ).filter(isFlexExperience);
  const experience =
    experiences.find(experience => experience.id === id) ??
    experiences.find(experience => experience.flex.available);

  if (!experience) {
    throw new Error('the park has no Lightning Lane experiences');
  }

  return experience;
}

// Returns the plan whose ID or type (LL, DAS, BG, RES) is the requested ID,
// or the first Lightning Lane that can still be modified.
function findPlan({ world, id }: OpenContext): Booking {
  const plans = world.plans.list();
  const plan =
    plans.find(plan => plan.id === id || plan.type === id) ??
    plans.find(plan => isLLMP(plan) && plan.modifiable);

  if (!plan) {
    throw new Error(`no plan matches "${id}"`);
  }

  return plan;
}

function findLightningLane(context: OpenContext): LLMP {
  const plan = context.world.plans.list().find(plan => {
    return isLLMP(plan) && plan.modifiable;
  });

  if (!plan || !isLLMP(plan)) {
    throw new Error('there is no Lightning Lane to modify');
  }

  return plan;
}

async function requestOffer(context: OpenContext): Promise<Offer<undefined>> {
  const { ll } = context.clients;
  const { eligible } = await ll.guests();

  return ll.offer(findExperience(context), eligible, {
    date: parkDate(),
  });
}

function ignore() {}

// The Lightning Lane screens that can be opened directly with `screen=<name>`.
// To add one, build its element from the preview's data here.
export const LL_SCREENS: Record<string, ScreenOpener> = {
  async book(context) {
    return <BookExperience experience={findExperience(context)} />;
  },

  async booking(context) {
    return <BookingDetails booking={findPlan(context)} />;
  },

  async 'new-booking'(context) {
    return <BookingDetails booking={findLightningLane(context)} isNew />;
  },

  async 'your-day'() {
    return <YourDay date={parkDate()} />;
  },

  async party() {
    return <PartySelector />;
  },

  async 'modify-party'(context) {
    const experience = findExperience(context);
    const guests = await context.clients.ll.guests();

    return (
      <ModifyParty
        party={{
          ...guests,
          selected: guests.eligible,
          setSelected: ignore,
          experience,
        }}
      />
    );
  },

  async 'return-time'(context) {
    return (
      <SelectReturnTime
        offer={await requestOffer(context)}
        onOfferChange={ignore}
      />
    );
  },

  async 'change-time'(context) {
    return <ChangeBookingTime booking={findLightningLane(context)} />;
  },

  async 'new-return-time'(context) {
    const booking = findLightningLane(context);
    const offer = await context.clients.ll.offer(
      {
        ...booking.experience,
        flex: {
          available: true,
          nextAvailableTime: booking.end.time,
        },
      },
      booking.guests,
      {
        booking,
      }
    );

    return <BookNewReturnTime offer={offer} />;
  },

  async cancel(context) {
    return (
      <CancelGuests booking={findLightningLane(context)} onCancel={ignore} />
    );
  },

  async das(context) {
    return <DasPartyList parties={await context.clients.das.parties()} />;
  },

  async 'das-experiences'({ park }) {
    return <DasExperienceList park={park} onSelect={ignore} />;
  },

  async 'das-selection'({ clients, park }) {
    const [party] = await clients.das.parties();

    if (!party) {
      throw new Error('there is no DAS party in this scenario');
    }

    return <DasSelection park={park} party={party} />;
  },
};
