import { DateTime, ParkTime } from '@/datetime';

import { authStore } from './auth';
import { avatarUrl } from './avatar';
import { ApiClient } from './client';
import { DasBooking } from './itinerary';
import { Experience as ExperienceData, InvalidId, Park } from './resort';

export type { DasBooking };

const PRIMARY_GUEST_SUFFIX = / \(Me\)$/;

export type Experience = ExperienceData & {
  available: boolean;
  time: ParkTime;
};

type ApiExperience = {
  id: string;
  name: string;
  type: 'ATTRACTION' | 'ENTERTAINMENT';
  available: boolean;
  nextAvailableStartDateTime?: string;
  nextAvailableEndDateTime?: string;
};

export type Guest = {
  id: string;
  name: string;
  avatarImageUrl?: string;
  characterId?: string;
};

type EntitledGuest = Guest & {
  entitlementId: string;
};

export type DasParty = {
  primaryGuest: Guest;
  linkedGuests: Guest[];
  selectionLimit: number;
};

// The experience and guests of a DAS return time request.
type Selection = {
  experience: Experience;
  primaryGuest: Guest;
  guests: Guest[];
};

type ConflictType =
  'PRIMARY_GUEST_NOT_ELIGIBLE' | 'PRODUCT_TYPE_LIMIT_REACHED' | 'NOT_IN_PARK';

type EligibilityGroup = {
  type: 'ELIGIBLE' | ConflictType;
  guestIds: string[];
};

export type EligibilityConflicts = Record<string, ConflictType | undefined>;

type ExperiencesResponse = {
  experiences: ApiExperience[];
};

type PartiesResponse = {
  bookingGuestId: string;
  parties: DasParty[];
};

type EligibilityResponse = {
  eligibility: EligibilityGroup[];
};

type ReturnWindow = {
  startDateTime: string;
  endDateTime: string;
};

type BookingResponse = {
  booking: ReturnWindow & {
    id: string;
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

export class ConflictsError extends Error {
  readonly name = 'ConflictsError';

  constructor(readonly conflicts: EligibilityConflicts) {
    super();
  }
}

export class ExperienceUnavailable extends Error {
  readonly name = 'ExperienceUnavailable';
}

function apiPath(version: number, subpath: string): string {
  return `/das-vas/api/v${version}/${subpath}`;
}

function toGuest(guest: Guest): Guest {
  return {
    id: guest.id,
    name: guest.name.replace(PRIMARY_GUEST_SUFFIX, ''),
    avatarImageUrl: avatarUrl(guest.characterId),
  };
}

function guestIdParams({ primaryGuest, guests }: Selection) {
  return {
    primaryGuestId: primaryGuest.id,
    guestIds: guests.map(guest => guest.id).join(','),
  };
}

function conflictsByGuestId(groups: EligibilityGroup[]): EligibilityConflicts {
  const conflicts: EligibilityConflicts = {};

  for (const group of groups) {
    if (group.type === 'ELIGIBLE') {
      continue;
    }

    for (const guestId of group.guestIds) {
      conflicts[guestId] = group.type;
    }
  }

  return conflicts;
}

export class DasClient extends ApiClient {
  protected bookingGuestId: string | undefined;

  // Returns the park's experiences that currently offer a DAS return time,
  // sorted by name.
  async experiences(park: Park): Promise<Experience[]> {
    const parkId = encodeURIComponent(park.id);

    const { data } = await this.request<ExperiencesResponse>({
      path: apiPath(2, `availability/parks/${parkId}/experiences`),
    });

    return data.experiences
      .flatMap(apiExperience => this.experience(apiExperience) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async parties(): Promise<DasParty[]> {
    const swid = encodeURIComponent(authStore.getData().swid);

    const { data } = await this.request<PartiesResponse>({
      path: apiPath(1, `users/${swid}/parties`),
    });

    this.bookingGuestId = data.bookingGuestId;

    return data.parties.map(party => {
      return {
        primaryGuest: toGuest(party.primaryGuest),
        linkedGuests: party.linkedGuests.map(toGuest),
        selectionLimit: party.selectionLimit,
      };
    });
  }

  async book(selection: Selection): Promise<DasBooking> {
    const { experience, primaryGuest, guests } = selection;

    await this.requireEligibility(selection);

    const returnWindow = await this.availability(selection);
    const { data } = await this.request<BookingResponse>({
      path: apiPath(2, 'bookings'),
      data: {
        bookingGuestId: this.bookingGuestId,
        primaryGuestId: primaryGuest.id,
        guestIds: guests.map(guest => guest.id),
        experienceId: experience.id,
        ...returnWindow,
      },
    });

    const { booking } = data;
    const guestsById = new Map(guests.map(guest => [guest.id, guest]));

    return {
      type: 'DAS',
      subtype: 'IN_PARK',
      id: booking.id,
      facilityId: experience.id,
      name: experience.name,
      experience,
      land: experience.land,
      park: experience.park,
      start: DateTime.from(booking.startDateTime),
      guests: booking.entitlements.map(entitlement => {
        const guest = guestsById.get(entitlement.guestId);

        return {
          id: entitlement.guestId,
          name: guest?.name ?? '',
          avatarImageUrl: guest?.avatarImageUrl,
          entitlementId: entitlement.id,
        };
      }),
    };
  }

  async cancelBooking(guests: EntitledGuest[]): Promise<void> {
    const entitlementIds = guests
      .map(guest => encodeURIComponent(guest.entitlementId))
      .join(',');

    await this.request({
      path: apiPath(1, `entitlements/${entitlementIds}`),
      method: 'DELETE',
    });
  }

  // Returns undefined for an experience that has no return time available or
  // isn't in BG1's data.
  protected experience(apiExperience: ApiExperience): Experience | undefined {
    const { id, available, nextAvailableStartDateTime } = apiExperience;

    if (!available || !nextAvailableStartDateTime) {
      return undefined;
    }

    try {
      return {
        ...this.resort.experience(id),
        available,
        time: DateTime.from(nextAvailableStartDateTime).time,
      };
    } catch (error) {
      if (error instanceof InvalidId) {
        return undefined;
      }

      throw error;
    }
  }

  // Throws ConflictsError unless every guest can make the selection.
  protected async requireEligibility(selection: Selection): Promise<void> {
    const { experience, guests } = selection;

    const { data } = await this.request<EligibilityResponse>({
      path: apiPath(1, 'eligibility'),
      params: {
        experienceId: experience.id,
        parkId: experience.park.id,
        ...guestIdParams(selection),
      },
    });

    const eligibleGroup = data.eligibility.find(group => {
      return group.type === 'ELIGIBLE';
    });
    const eligibleIds = new Set(eligibleGroup?.guestIds);

    if (!guests.every(guest => eligibleIds.has(guest.id))) {
      throw new ConflictsError(conflictsByGuestId(data.eligibility));
    }
  }

  protected async availability(selection: Selection): Promise<ReturnWindow> {
    const experienceId = encodeURIComponent(selection.experience.id);

    const { data } = await this.request<ReturnWindow>({
      path: apiPath(3, `availability/experiences/${experienceId}`),
      params: guestIdParams(selection),
    });
    const { startDateTime, endDateTime } = data;

    if (!startDateTime || !endDateTime) {
      throw new ExperienceUnavailable();
    }

    return {
      startDateTime,
      endDateTime,
    };
  }
}
