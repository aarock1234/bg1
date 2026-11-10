import { DateTime, ParkTime, parkDate } from '@/datetime';

import { encryptOfferId } from '../diu';
import {
  ApiGuest,
  BOOKING_TIMEOUT_MS,
  Experience,
  Guest,
  Guests,
  GuestsResponse,
  HourlyTimes,
  LLClient,
  LLMP,
  Offer,
  OfferError,
  OfferExperience,
  OfferOptions,
  throwOnNotModifiable,
} from '../ll';
import { Park } from '../resort';

// The experience and park used to look up the party when no experience has
// been chosen yet.
const FALLBACK_EXPERIENCE_ID = '353295';
const FALLBACK_PARK_ID = '330339';

// The return time requested when an experience doesn't report its next one.
const DEFAULT_SELECTED_TIME = '08:00:00';

type OfferResponse = {
  offer: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: 'ACTIVE' | 'DELETED';
  };
  eligibleGuests?: ApiGuest[];
  ineligibleGuests?: ApiGuest[];
};

export type BookingResponse = {
  booking: {
    id: 'NEW_BOOKING' | 'MODIFIED_BOOKING';
    startDateTime: string;
    endDateTime: string;
    entitlements: {
      id: string;
      guestId: string;
    }[];
    singleExperienceDetails: {
      experienceId: string;
      parkId: string;
    };
  };
};

// Whether a modification keeps the experience and only moves its time.
function modificationType(
  booking: LLMP,
  experience: OfferExperience
): 'TIME' | 'EXPERIENCE' {
  return booking.experience.id === experience.id ? 'TIME' : 'EXPERIENCE';
}

// Disneyland expects the guest with the lowest ID as the primary guest.
function primaryGuestId(guests: Guest[]): string | undefined {
  const [lowestId] = guests
    .map(guest => guest.id)
    .sort((a, b) => a.localeCompare(b));

  return lowestId;
}

export class LLClientDLR extends LLClient {
  async experiences(
    park: Park,
    date: string = parkDate()
  ): Promise<Experience[]> {
    return super.experiences(park, date);
  }

  async guests(experience?: Pick<Experience, 'id'>): Promise<Guests> {
    const parkId = experience
      ? this.resort.experience(experience.id).park.id
      : FALLBACK_PARK_ID;

    const { data } = await this.request<GuestsResponse>({
      path: '/ea-vas/api/v1/guests',
      params: {
        productType: 'FLEX',
        experienceId: experience?.id ?? FALLBACK_EXPERIENCE_ID,
        parkId,
      },
      sensorData: true,
      userId: true,
    });

    return this.parseGuestData(data);
  }

  async offer<B extends Offer['booking']>(
    experience: OfferExperience,
    guests: Guest[],
    options: OfferOptions<B> = {}
  ): Promise<Offer<B>> {
    const booking = 'booking' in options ? options.booking : undefined;
    throwOnNotModifiable(booking);

    const expectedTime = experience.flex?.nextAvailableTime;
    const modificationFields = booking
      ? {
          date: DateTime.now().date,
          modificationType: modificationType(booking, experience),
        }
      : {};

    const { data } = await this.request<OfferResponse>({
      path: booking
        ? '/ea-vas/api/v1/products/modifications/flex/offers'
        : '/ea-vas/api/v2/products/flex/offers',
      data: {
        guestIds: (booking?.guests ?? guests).map(guest => guest.id),
        ineligibleGuests: [],
        primaryGuestId: primaryGuestId(guests),
        parkId: experience.park.id,
        experienceId: experience.id,
        selectedTime: expectedTime ?? DEFAULT_SELECTED_TIME,
        ...modificationFields,
      },
      sensorData: true,
    });

    const { offer, eligibleGuests = [], ineligibleGuests = [] } = data;
    const party: Guests = {
      eligible: eligibleGuests.map(guest => this.guest(guest)),
      ineligible: ineligibleGuests.map(guest => this.guest(guest)),
    };

    if (offer.status !== 'ACTIVE') {
      throw new OfferError(party);
    }

    return this.updateLastOffer(
      {
        id: offer.id,
        start: new DateTime(offer.date, ParkTime.from(offer.startTime)),
        end: new DateTime(offer.date, ParkTime.from(offer.endTime)),
        booking: booking as B,
        guests: party,
        experience,
        itinerary: [],
      },
      expectedTime
    );
  }

  // Disneyland always assigns the next available return time.
  async times(): Promise<HourlyTimes> {
    return [];
  }

  async changeOfferTime<B extends Offer['booking']>(
    offer: Offer<B>
  ): Promise<Offer<B>> {
    return offer;
  }

  async book(
    offer: Offer,
    guestsToModify: Pick<Guest, 'id'>[] = offer.guests.eligible
  ): Promise<LLMP> {
    const { booking: existingBooking } = offer;
    const guestIdsToModify = new Set(guestsToModify.map(guest => guest.id));
    const modificationFields = existingBooking
      ? {
          date: DateTime.now().date,
          modificationType: modificationType(existingBooking, offer.experience),
          existingEntitlements: existingBooking.guests
            .filter(guest => guestIdsToModify.has(guest.id))
            .map(guest => {
              return {
                entitlementId: guest.entitlementId,
                entitlementBookingId: guest.bookingId,
              };
            }),
          guestIdsToExclude: existingBooking.guests
            .filter(guest => !guestIdsToModify.has(guest.id))
            .map(guest => guest.id),
        }
      : {};

    const { data } = await this.request<BookingResponse>({
      path: existingBooking
        ? '/ea-vas/api/v2/products/modifications/flex/bookings'
        : '/ea-vas/api/v2/products/flex/bookings',
      data: {
        offerId: offer.id,
        ...(await encryptOfferId(offer.id)),
        ...modificationFields,
      },
      sensorData: true,
      timeoutMs: BOOKING_TIMEOUT_MS,
    });

    return this.lightningLane(offer, data.booking);
  }

  protected lightningLane(
    offer: Offer,
    booked: BookingResponse['booking']
  ): LLMP {
    const [firstEntitlement] = booked.entitlements;

    if (!firstEntitlement) {
      throw new Error('booking response has no entitlements');
    }

    const { experienceId } = booked.singleExperienceDetails;
    const { id, name, park } = this.resort.experience(experienceId);
    const guestsById = new Map(
      offer.guests.eligible.map(guest => [guest.id, guest])
    );

    return {
      type: 'LL',
      subtype: 'MP',
      id: firstEntitlement.id,
      facilityId: id,
      name,
      experience: offer.experience,
      land: offer.experience.land,
      park,
      start: DateTime.from(booked.startDateTime),
      end: DateTime.from(booked.endDateTime),
      cancellable: true,
      modifiable: true,
      guests: booked.entitlements.map(entitlement => {
        return {
          id: entitlement.guestId,
          name: 'Guest',
          ...guestsById.get(entitlement.guestId),
          entitlementId: entitlement.id,
        };
      }),
    };
  }
}
