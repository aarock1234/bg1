import { DateTime, ParkTime, parkDate } from '@/datetime';

import {
  ApiGuest,
  Experience,
  Guest,
  Guests,
  HourlyTimes,
  IneligibleReason,
  LLClient,
  LLMP,
  LLRules,
  Offer,
  OfferError,
  OfferExperience,
  OfferItineraryItem,
  OfferOptions,
  OrderDetails,
  ParkHours,
  throwOnNotModifiable,
  withParkTimes,
} from '../ll';

const EXPERIENCES_PATH = '/ea-vas/planning/api/v1/experiences';

// The return time requested when an experience doesn't report its next one.
const DEFAULT_TARGETED_TIME = '08:00:00';

// Disney fits a new Lightning Lane between existing ones rather than offering
// the earliest return time. An offer later than expected by more than this is
// moved back to the expected time.
const MAX_OFFER_DELAY_SECONDS = 10 * 60;

type WdwIneligibleGuest = Omit<ApiGuest, 'ineligibleReason'> & {
  ineligibleReason?: {
    ineligibleReason: IneligibleReason;
    isSoftConflict?: boolean;
    metadata?: {
      facilityIds: string[];
    };
  };
};

type WdwGuestsResponse = {
  guests: ApiGuest[];
  ineligibleGuests: WdwIneligibleGuest[];
};

type ItineraryItemBase = {
  facilityId: string;
  startDateTime: string;
  startTime: string;
  endDateTime?: string;
  endTime?: string;
  showTimeInfo?: {
    showStartTime: string;
    showEndTime: string;
  };
};

export type OfferItem = ItineraryItemBase & {
  type: 'OFFER_ITEM';
  offerSetId: string;
  offerId: string;
  offerType: 'FLEX';
  endDateTime: string;
  endTime: string;
};

type ExistingItem = ItineraryItemBase & {
  type: 'EXISTING_ITEM';
  id: string;
};

type EventItem = ItineraryItemBase & {
  type: 'EVENT_ITEM';
  eventType: 'PARK_OPEN' | 'PARK_CLOSE';
};

type ItineraryItem = OfferItem | ExistingItem | EventItem;

type OfferSetResponse = {
  itinerary?: {
    items?: ItineraryItem[];
  };
  party: WdwGuestsResponse;
};

type TimesResponse = {
  hourSegmentGroups: {
    inventorySlotsAvailability: {
      startTime: string;
    }[];
  }[];
};

type ChangeTimeResponse = {
  updatedPlanningOfferDisplayItem: OfferItem;
};

type BookedExperience = {
  experienceId: string;
  startDateTime: string;
  endDateTime: string;
  guests: {
    entitlementId: string;
    guestId: string;
  }[];
};

export type NewBookingResponse = {
  entitlementExperiences: BookedExperience[];
  party: WdwGuestsResponse;
};

export type ModBookingResponse = {
  booking: BookedExperience;
  party: WdwGuestsResponse;
};

type OrderedGuest = Guest & {
  orderDetails: OrderDetails;
};

type ParsedItinerary = {
  offerItem?: OfferItem;
  itinerary: OfferItineraryItem[];
  parkHours?: ParkHours;
};

function isModification(offer: Offer): offer is Offer<LLMP> {
  return !!offer.booking;
}

function hasOrderDetails(guest: Guest): guest is OrderedGuest {
  return !!guest.orderDetails;
}

// Modifying a booking uses the same endpoints as a new one, under `/mod`.
function offerSetPath(booking: LLMP | undefined, path: string): string {
  const modification = booking ? '/mod' : '';

  return `${EXPERIENCES_PATH}${modification}/offerset${path}`;
}

// The stretch of time around an existing plan during which another Lightning
// Lane would conflict with it.
export class Overlap {
  protected startTime;
  protected endTime;

  constructor(
    item: Pick<OfferItineraryItem, 'startTime' | 'endTime' | 'showTimeInfo'>
  ) {
    const startTime = ParkTime.from(item.startTime);

    this.startTime = startTime.add({
      minutes: -40,
    });
    this.endTime = item.showTimeInfo
      ? ParkTime.from(item.showTimeInfo.showEndTime).add({
          minutes: -20,
        })
      : startTime.add({
          minutes: item.endTime ? 40 : 60,
        });
  }

  contains(time: ParkTime): boolean {
    return time > this.startTime && time < this.endTime;
  }
}

export class LLClientWDW extends LLClient {
  readonly rules: LLRules = {
    maxPartySize: 20,
    parkModify: true,
    prebook: true,
    timeSelect: true,
  };

  async guests(
    experience?: Pick<Experience, 'id'>,
    date?: string
  ): Promise<Guests> {
    const park = experience
      ? this.resort.experience(experience.id).park
      : this.resort.parks[0];

    const { data } = await this.request<WdwGuestsResponse>({
      path: `${EXPERIENCES_PATH}/guest/guests`,
      data: {
        date: date ?? DateTime.now().date,
        facilityId: experience?.id ?? null,
        parkId: park?.id,
      },
      sensorData: true,
    });

    return this.parseWdwGuestData(data);
  }

  async offer<B extends Offer['booking']>(
    experience: OfferExperience,
    guests: Guest[],
    options: OfferOptions<B> = {}
  ): Promise<Offer<B>> {
    const booking = 'booking' in options ? options.booking : undefined;
    const date = 'date' in options ? options.date : parkDate();
    throwOnNotModifiable(booking);

    const expectedTime = experience.flex?.nextAvailableTime;
    const experienceFields = booking
      ? {
          experienceId: experience.id,
          originalExperienceId: booking.experience.id,
          originalEntitlementIds: booking.guests.map(guest => {
            return guest.entitlementId;
          }),
        }
      : {
          experienceIds: [experience.id],
        };

    const { data } = await this.request<OfferSetResponse>({
      path: offerSetPath(booking, '/generate'),
      data: {
        date: booking ? booking.start.date : date,
        parkId: experience.park.id,
        guestIds: guests.map(guest => guest.id),
        targetedTime: expectedTime ?? DEFAULT_TARGETED_TIME,
        ignoredBookedExperienceIds: null,
        ...experienceFields,
      },
      sensorData: true,
    });

    const party = this.parseWdwGuestData(data.party);
    const { offerItem, itinerary, parkHours } = this.parseItinerary(
      data.itinerary?.items ?? [],
      experience
    );

    if (!offerItem) {
      throw new OfferError(party);
    }

    const guestsById = new Map(guests.map(guest => [guest.id, guest]));
    const offer: Offer<B> = {
      offerSetId: offerItem.offerSetId,
      id: offerItem.offerId,
      start: DateTime.from(offerItem.startDateTime),
      end: DateTime.from(offerItem.endDateTime),
      experience,
      guests: {
        eligible: party.eligible.map(guest => {
          return {
            ...guestsById.get(guest.id),
            ...guest,
          };
        }),
        ineligible: party.ineligible,
      },
      booking: booking as B,
      itinerary,
      parkHours,
    };

    const isLaterThanExpected =
      expectedTime !== undefined &&
      +offer.start.time - +expectedTime > MAX_OFFER_DELAY_SECONDS;

    if (isLaterThanExpected) {
      try {
        return await this.changeOfferTime(offer, expectedTime);
      } catch (error) {
        // The original offer is still good.
        console.error(error);
      }
    }

    return this.updateLastOffer(offer, expectedTime);
  }

  async times(offer: Offer): Promise<HourlyTimes> {
    const { data } = await this.request<TimesResponse>({
      path: offerSetPath(offer.booking, '/times'),
      data: {
        experienceId: offer.experience.id,
        parkId: offer.experience.park.id,
        date: offer.start.date,
        offerId: offer.id,
        offerSetIds: [offer.offerSetId],
        guestIds: offer.guests.eligible.map(guest => guest.id),
        offerType: 'FLEX',
        experienceIdsToIgnore: [],
        originalOrderItemId: null,
      },
      sensorData: true,
    });

    return data.hourSegmentGroups.map(group => {
      return group.inventorySlotsAvailability.map(slot => {
        return ParkTime.from(slot.startTime);
      });
    });
  }

  async changeOfferTime<B extends Offer['booking']>(
    offer: Offer<B>,
    time: ParkTime
  ): Promise<Offer<B>> {
    const offerSetFields = offer.booking
      ? {
          offerSetId: offer.offerSetId,
        }
      : {
          offerSetIds: [offer.offerSetId],
        };

    const { data } = await this.request<ChangeTimeResponse>({
      path: offerSetPath(offer.booking, '/times/fulfill'),
      data: {
        parkId: offer.experience.park.id,
        date: offer.start.date,
        offerId: offer.id,
        ...offerSetFields,
        offerType: 'FLEX',
        guestIds: offer.guests.eligible.map(guest => guest.id),
        targetSlot: {
          startTime: time,
          endTime: time,
        },
        experienceIdsToIgnore: [],
      },
      sensorData: true,
    });
    const newOffer = data.updatedPlanningOfferDisplayItem;

    return this.updateLastOffer(
      {
        ...offer,
        id: newOffer.offerId,
        offerSetId: newOffer.offerSetId,
        start: DateTime.from(newOffer.startDateTime),
        end: DateTime.from(newOffer.endDateTime),
      },
      time
    );
  }

  async book<B extends Offer['booking']>(
    offer: Offer<B>,
    guestsToModify?: Pick<Guest, 'id'>[]
  ): Promise<LLMP> {
    if (isModification(offer)) {
      return this.modify(offer, guestsToModify);
    }

    const { data } = await this.request<NewBookingResponse>({
      path: `${EXPERIENCES_PATH}/entitlements/book`,
      data: {
        offerSetId: offer.offerSetId,
        orderGuestDetails: offer.guests.eligible
          .filter(hasOrderDetails)
          .map(guest => {
            const { externalIdentifier, ...orderIds } = guest.orderDetails;

            return {
              guestDetails: [
                {
                  guestId: guest.id,
                  externalIdentifier,
                },
              ],
              ...orderIds,
            };
          }),
      },
      sensorData: true,
    });

    return this.lightningLane(offer.experience, data);
  }

  protected async modify(
    offer: Offer<LLMP>,
    guestsToModify: Pick<Guest, 'id'>[] = offer.guests.eligible
  ): Promise<LLMP> {
    const guestIdsToModify = new Set(guestsToModify.map(guest => guest.id));
    const entitlementIdsByGuestId = new Map(
      offer.booking.guests.map(guest => [guest.id, guest.entitlementId])
    );

    const { data } = await this.request<ModBookingResponse>({
      path: `${EXPERIENCES_PATH}/mod/entitlements/book`,
      data: {
        offerSetId: offer.offerSetId,
        eligibleGuestsEntitlements: offer.guests.eligible
          .filter(guest => guestIdsToModify.has(guest.id))
          .map(guest => {
            return {
              guestId: guest.id,
              entitlementId: entitlementIdsByGuestId.get(guest.id),
              ...guest.orderDetails,
            };
          }),
      },
      sensorData: true,
    });

    return this.lightningLane(offer.experience, {
      entitlementExperiences: [data.booking],
      party: data.party,
    });
  }

  // Sorts an offer response's itinerary into the offer itself, the guest's
  // existing plans, and the park's hours.
  protected parseItinerary(
    items: ItineraryItem[],
    experience: OfferExperience
  ): ParsedItinerary {
    const parsed: ParsedItinerary = {
      itinerary: [],
    };
    let openTime: ParkTime | undefined;
    let closeTime: ParkTime | undefined;

    for (const item of items) {
      switch (item.type) {
        case 'OFFER_ITEM':
          if (item.facilityId === experience.id) {
            parsed.offerItem = item;
          }
          break;
        case 'EXISTING_ITEM': {
          const existingPlan = withParkTimes(item);

          parsed.itinerary.push({
            ...existingPlan,
            overlap: new Overlap(existingPlan),
          });
          break;
        }
        case 'EVENT_ITEM':
          if (item.eventType === 'PARK_OPEN') {
            openTime = ParkTime.from(item.startTime);
          } else if (item.eventType === 'PARK_CLOSE') {
            closeTime = ParkTime.from(item.startTime);
          }
          break;
      }
    }

    if (openTime && closeTime) {
      parsed.parkHours = {
        openTime,
        closeTime,
      };
    }

    return parsed;
  }

  protected lightningLane(
    experience: OfferExperience,
    response: NewBookingResponse
  ): LLMP {
    const [booked] = response.entitlementExperiences;
    const [firstBookedGuest] = booked?.guests ?? [];

    if (!booked || !firstBookedGuest) {
      throw new Error('booking response has no entitlements');
    }

    const entitlementIdsByGuestId = new Map(
      booked.guests.map(guest => [guest.guestId, guest.entitlementId])
    );
    const guests: LLMP['guests'] = [];

    for (const apiGuest of response.party.guests) {
      const entitlementId = entitlementIdsByGuestId.get(apiGuest.id);

      if (entitlementId) {
        guests.push({
          ...this.guest(apiGuest),
          entitlementId,
        });
      }
    }

    return {
      type: 'LL',
      subtype: 'MP',
      id: firstBookedGuest.entitlementId,
      facilityId: experience.id,
      name: experience.name,
      experience,
      land: experience.land,
      park: experience.park,
      start: DateTime.from(booked.startDateTime),
      end: DateTime.from(booked.endDateTime),
      cancellable: true,
      modifiable: true,
      guests,
    };
  }

  // Walt Disney World nests each ineligible guest's reason inside an object.
  protected parseWdwGuestData(data: WdwGuestsResponse): Guests {
    return this.parseGuestData({
      guests: data.guests,
      ineligibleGuests: data.ineligibleGuests.map(guest => {
        return {
          ...guest,
          ineligibleReason: guest.ineligibleReason?.ineligibleReason,
        };
      }),
    });
  }
}
