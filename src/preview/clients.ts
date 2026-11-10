import { RequestError } from '@/api/client';
import {
  DasBooking,
  DasClient,
  Experience as DasExperience,
  DasParty,
} from '@/api/das';
import { Booking, ItineraryClient } from '@/api/itinerary';
import { LiveDataClient } from '@/api/livedata';
import {
  Experience,
  Guest,
  Guests,
  HourlyTimes,
  LLClient,
  LLMP,
  LLRules,
  Offer,
  OfferExperience,
  OfferOptions,
} from '@/api/ll';
import { Park, ResortId } from '@/api/resort';
import {
  JoinQueueResult,
  Queue,
  Guest as QueueGuest,
  VQClient,
} from '@/api/vq';
import { Clients } from '@/contexts/ClientsContext';
import { DateTime, ParkTime, parkDate } from '@/datetime';
import { sleep } from '@/sleep';

import { minutesFromNow } from './clock';
import {
  PARK_HOURS,
  liveExperiences,
  liveShows,
  rankedFlexAttractions,
} from './data/experiences';
import {
  PARTY,
  ineligiblePartyResponse,
  partyResponse,
  toPlanGuest,
} from './data/guests';
import { PlanBook } from './data/plans';
import {
  GUEST_NOT_IN_PARK_ID,
  QUEUE_GUESTS,
  previewQueues,
} from './data/queues';
import { Scenario } from './options';
import { PreviewResort, experiencesIn, findPark } from './resort';

// How long a fake request takes, so loading states are briefly visible.
const RESPONSE_DELAY_MS = 250;

const STATUS_NETWORK_FAILURE = 0;
const STATUS_GONE = 410;

const LAST_RETURN_HOUR = 21;
const RETURN_TIME_MINUTES = [5, 25, 45];

// How many attractions offer a DAS return time in the preview.
const DAS_EXPERIENCE_COUNT = 8;

const RULES_BY_RESORT: Record<ResortId, LLRules> = {
  WDW: {
    maxPartySize: 20,
    parkModify: true,
    prebook: true,
    timeSelect: true,
  },
  DLR: {
    maxPartySize: 12,
    parkModify: false,
    prebook: false,
    timeSelect: false,
  },
};

// Everything the fake clients share: the resort's data, the scenario being
// previewed, and the guest's plans.
export type PreviewWorld = {
  previewResort: PreviewResort;
  scenario: Scenario;
  plans: PlanBook;
};

function failedRequest(status: number): RequestError {
  return new RequestError({
    ok: false,
    status,
    data: null,
  });
}

// Answers a fake request the way the scenario says requests go: after a
// short delay, with a network failure, or never.
async function respond<T>(scenario: Scenario, answer: () => T): Promise<T> {
  if (scenario === 'loading') {
    return new Promise<T>(() => undefined);
  }

  await sleep(RESPONSE_DELAY_MS);

  if (scenario === 'error') {
    throw failedRequest(STATUS_NETWORK_FAILURE);
  }

  return answer();
}

class PreviewLLClient extends LLClient {
  readonly rules: LLRules = RULES_BY_RESORT[this.resort.id];
  protected offerCount = 0;

  constructor(protected world: PreviewWorld) {
    super(world.previewResort.resort);
  }

  async experiences(park: Park): Promise<Experience[]> {
    const { previewResort, scenario } = this.world;

    return respond(scenario, () => {
      if (scenario === 'empty') {
        return [];
      }

      this.nextBookTime = minutesFromNow(25);

      return liveExperiences(experiencesIn(previewResort, park), park).map(
        experience => {
          return {
            ...experience,
            experienced:
              experience.experienced || this.tracker.experienced(experience),
          };
        }
      );
    });
  }

  async guests(): Promise<Guests> {
    const { scenario } = this.world;

    return respond(scenario, () => {
      if (scenario === 'empty') {
        return {
          eligible: [],
          ineligible: [],
        };
      }

      return this.parseGuestData(
        scenario === 'ineligible' ? ineligiblePartyResponse() : partyResponse()
      );
    });
  }

  async offer<B extends Offer['booking']>(
    experience: OfferExperience,
    guests: Guest[],
    options: OfferOptions<B> = {}
  ): Promise<Offer<B>> {
    const { scenario } = this.world;
    const booking = 'booking' in options ? options.booking : undefined;
    const date = 'date' in options ? options.date : parkDate();
    const expectedTime = experience.flex?.nextAvailableTime;

    return respond(scenario, () => {
      if (scenario === 'sold-out' || !expectedTime) {
        throw failedRequest(STATUS_GONE);
      }

      const offer: Offer<B> = {
        ...this.returnWindow(booking?.start.date ?? date, expectedTime),
        experience,
        guests: {
          eligible: guests,
          ineligible: [],
        },
        itinerary: [],
        parkHours: PARK_HOURS,
        booking: booking as B,
      };

      return this.updateLastOffer(offer, expectedTime);
    });
  }

  async times(offer: Offer): Promise<HourlyTimes> {
    return respond(this.world.scenario, () => {
      const hourlyTimes: HourlyTimes = [];

      for (let hour = offer.start.time.hour; hour <= LAST_RETURN_HOUR; hour++) {
        hourlyTimes.push(
          RETURN_TIME_MINUTES.map(minute => new ParkTime(hour, minute))
        );
      }

      return hourlyTimes;
    });
  }

  async changeOfferTime<B extends Offer['booking']>(
    offer: Offer<B>,
    time: ParkTime
  ): Promise<Offer<B>> {
    return respond(this.world.scenario, () => {
      return this.updateLastOffer(
        {
          ...offer,
          ...this.returnWindow(offer.start.date, time),
        },
        time
      );
    });
  }

  async book<B extends Offer['booking']>(offer: Offer<B>): Promise<LLMP> {
    const { plans, scenario } = this.world;
    const { experience } = offer;
    const replacedBooking: LLMP | undefined = offer.booking;

    return respond(scenario, () => {
      const id = `ll-${experience.id}-${offer.id}`;
      const booking: LLMP = {
        type: 'LL',
        subtype: 'MP',
        id,
        facilityId: experience.id,
        name: experience.name,
        experience,
        land: experience.land,
        park: experience.park,
        start: offer.start,
        end: offer.end,
        cancellable: true,
        modifiable: true,
        guests: offer.guests.eligible.map(guest => {
          return {
            id: guest.id,
            name: guest.name,
            primary: guest.primary,
            avatarImageUrl: guest.avatarImageUrl,
            entitlementId: `${id}-${guest.id}`,
          };
        }),
      };

      if (replacedBooking) {
        plans.remove(replacedBooking.id);
      }

      plans.add(booking);

      return booking;
    });
  }

  async cancelBooking(guests: LLMP['guests']): Promise<void> {
    const { plans, scenario } = this.world;

    return respond(scenario, () => plans.removeGuests(guests));
  }

  protected returnWindow(
    date: string,
    startTime: ParkTime
  ): Pick<Offer, 'id' | 'offerSetId' | 'start' | 'end'> {
    this.offerCount += 1;

    return {
      id: `offer-${this.offerCount}`,
      offerSetId: `offer-set-${this.offerCount}`,
      start: new DateTime(date, startTime),
      end: new DateTime(
        date,
        startTime.add({
          hours: 1,
        })
      ),
    };
  }
}

class PreviewItineraryClient extends ItineraryClient {
  constructor(protected world: PreviewWorld) {
    super(world.previewResort.resort);
  }

  async plans(): Promise<Booking[]> {
    const { plans, scenario } = this.world;

    return respond(scenario, () => {
      const bookings = scenario === 'empty' ? [] : plans.list();
      this.onRefresh(bookings);

      return bookings;
    });
  }
}

class PreviewLiveDataClient extends LiveDataClient {
  constructor(protected world: PreviewWorld) {
    super(world.previewResort.resort);
  }

  async shows(park: Park): Promise<Record<string, Experience>> {
    const { previewResort, scenario } = this.world;

    if (scenario !== 'default') {
      return {};
    }

    return liveShows(experiencesIn(previewResort, park), park);
  }
}

class PreviewDasClient extends DasClient {
  constructor(protected world: PreviewWorld) {
    super(world.previewResort.resort);
  }

  async experiences(park: Park): Promise<DasExperience[]> {
    const { previewResort, scenario } = this.world;

    return respond(scenario, () => {
      const attractions = rankedFlexAttractions(
        experiencesIn(previewResort, park)
      );

      return attractions
        .slice(0, DAS_EXPERIENCE_COUNT)
        .map((experience, index) => {
          return {
            ...experience,
            available: true,
            time: minutesFromNow(20 + index * 10),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async parties(): Promise<DasParty[]> {
    if (this.world.scenario !== 'default') {
      return [];
    }

    const [primaryGuest, ...linkedGuests] = PARTY.map(toPlanGuest);

    if (!primaryGuest) {
      return [];
    }

    return [
      {
        primaryGuest,
        linkedGuests,
        selectionLimit: 4,
      },
    ];
  }

  async book(selection: Parameters<DasClient['book']>[0]): Promise<DasBooking> {
    const { plans, scenario } = this.world;
    const { experience, guests } = selection;

    return respond(scenario, () => {
      const id = `das-${experience.id}-${experience.time}`;
      const booking: DasBooking = {
        type: 'DAS',
        subtype: 'IN_PARK',
        id,
        facilityId: experience.id,
        name: experience.name,
        experience,
        land: experience.land,
        park: experience.park,
        start: new DateTime(parkDate(), experience.time),
        cancellable: true,
        guests: guests.map(guest => {
          return {
            ...guest,
            entitlementId: `${id}-${guest.id}`,
          };
        }),
      };

      plans.add(booking);

      return booking;
    });
  }

  async cancelBooking(guests: DasBooking['guests']): Promise<void> {
    const { plans, scenario } = this.world;

    return respond(scenario, () => plans.removeGuests(guests));
  }
}

class PreviewVQClient extends VQClient {
  constructor(protected world: PreviewWorld) {
    super(world.previewResort.resort);
  }

  async getQueues(): Promise<Queue[]> {
    const { previewResort, scenario } = this.world;

    return respond(scenario, () => {
      if (scenario === 'empty') {
        return [];
      }

      return previewQueues(findPark(previewResort.resort, undefined));
    });
  }

  async getLinkedGuests(): Promise<QueueGuest[]> {
    const { scenario } = this.world;

    return respond(scenario, () => {
      return scenario === 'empty' ? [] : QUEUE_GUESTS;
    });
  }

  // Everyone gets a boarding group except the guest who isn't in the park.
  async joinQueue(
    _queue: Pick<Queue, 'id'>,
    guests: Pick<QueueGuest, 'id'>[]
  ): Promise<JoinQueueResult> {
    return respond(this.world.scenario, () => {
      const conflicts: JoinQueueResult['conflicts'] = {};

      for (const guest of guests) {
        if (guest.id === GUEST_NOT_IN_PARK_ID) {
          conflicts[guest.id] = 'NOT_IN_PARK';
        }
      }

      return {
        boardingGroup: 42,
        conflicts,
        closed: false,
      };
    });
  }
}

// Creates clients with the same methods as the real ones that answer from
// made-up data instead of asking Disney.
export function createPreviewClients(world: PreviewWorld): Clients {
  const das = new PreviewDasClient(world);
  const itinerary = new PreviewItineraryClient(world);
  const liveData = new PreviewLiveDataClient(world);
  const ll = new PreviewLLClient(world);
  const vq = new PreviewVQClient(world);

  itinerary.onRefresh = bookings => ll.track(bookings);

  return {
    das,
    itinerary,
    liveData,
    ll,
    vq,
  };
}
