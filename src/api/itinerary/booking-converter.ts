import { DateTime, parkDate } from '@/datetime';

import { avatarUrl } from '../avatar';
import type {
  BoardingGroup,
  Booking,
  BookingDate,
  DasBooking,
  EntitledGuest,
  Guest,
  LightningLane,
  ParkPass,
  Reservation,
} from '../itinerary';
import { InvalidId } from '../resort';
import type { Experience, Land, Park, Resort } from '../resort';
import type {
  BoardingGroupItem,
  FastPassGuest,
  FastPassItem,
  ItemGuest,
  ItineraryItem,
  ItineraryResponse,
  ReservationItem,
} from './response';

// Dining and activity reservations stay listed this long after they start.
const RESERVATION_EXPIRATION_MINUTES = 60;

const BOOKING_TYPE_ORDER: Record<Booking['type'], number> = {
  APR: 0,
  BG: 1,
  DAS: 2,
  RES: 3,
  LL: 4,
};

const LIGHTNING_LANE_SUBTYPES: Record<string, LightningLane['subtype']> = {
  FLEX: 'MP',
  STANDARD: 'SP',
};

type ExperienceFields = Pick<
  LightningLane,
  'facilityId' | 'name' | 'land' | 'park' | 'experience'
>;

// Details from the response to use when an experience or park isn't in BG1's
// own data.
type ExperienceFallback = {
  parkId?: string;
  parkName?: string;
  name?: string;
};

// Asset and guest IDs arrive as `<id>;type=<type>`.
function typelessId(id: string): string {
  const [typeless = ''] = id.split(';');

  return typeless;
}

function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function startTimeValue(booking: Booking): number {
  if (!booking.start.time) {
    return -1;
  }

  return +booking.start.time;
}

function compareBookings(a: Booking, b: Booking): number {
  return (
    compareStrings(a.start.date, b.start.date) ||
    startTimeValue(a) - startTimeValue(b) ||
    BOOKING_TYPE_ORDER[a.type] - BOOKING_TYPE_ORDER[b.type] ||
    a.name.localeCompare(b.name) ||
    compareStrings(a.id, b.id)
  );
}

// Orders the primary guest first, then guests with Disney accounts, then by
// name.
function compareReservationGuests(a: Guest, b: Guest): number {
  return (
    Number(b.primary) - Number(a.primary) ||
    Number(!b.transactional) - Number(!a.transactional) ||
    a.name.localeCompare(b.name)
  );
}

function fastPassEnd(item: FastPassItem): DateTime | BookingDate | undefined {
  if (item.displayEndTime) {
    return DateTime.from(`${item.displayEndDate}T${item.displayEndTime}`);
  }

  if (item.displayEndDate) {
    return {
      date: item.displayEndDate,
    };
  }

  return undefined;
}

function unknownPark(id: string, name: string): Park {
  return {
    id,
    name,
    icon: '',
    geo: {
      n: 0,
      s: 0,
      e: 0,
      w: 0,
    },
    color: '',
    dropTimes: [],
  };
}

function unknownLand(park: Park, name = ''): Land {
  return {
    name,
    sort: 0,
    color: '',
    park,
  };
}

// Converts an itinerary API response into BG1's bookings.
export class BookingConverter {
  protected items;
  protected assets;
  protected profiles;
  protected primaryGuestId;
  protected today = DateTime.now().date;
  protected parkDay = parkDate();
  protected earliestReservationStart = new Date();

  constructor(
    protected resort: Resort,
    response: ItineraryResponse
  ) {
    this.items = response.items ?? [];
    this.assets = response.assets ?? {};
    this.profiles = response.profiles ?? {};
    this.primaryGuestId = typelessId(response.loggedInGuestId ?? '');
    this.earliestReservationStart.setMinutes(
      this.earliestReservationStart.getMinutes() -
        RESERVATION_EXPIRATION_MINUTES
    );
  }

  // Returns the bookings in itinerary order. An item that can't be converted
  // is skipped so that it doesn't hide the rest of the guest's plans.
  bookings(): Booking[] {
    const bookings: Booking[] = [];

    for (const item of this.items) {
      try {
        const booking = this.booking(item);

        if (booking) {
          bookings.push(booking);
        }
      } catch (error) {
        console.error(error);
      }
    }

    return bookings.sort(compareBookings);
  }

  protected booking(item: ItineraryItem): Booking | undefined {
    switch (item.type) {
      case 'FASTPASS':
        return this.fastPassBooking(item);
      case 'VIRTUAL_QUEUE_POSITION':
        return this.boardingGroup(item);
      case 'DINING':
      case 'ACTIVITY':
        return this.reservation(item);
      default:
        return undefined;
    }
  }

  protected fastPassBooking(item: FastPassItem): Booking | undefined {
    switch (item.kind) {
      case 'PARK_PASS':
        return this.parkPass(item);
      case 'DAS':
      case 'FDS':
        return this.dasSelection(item);
      default:
        return this.lightningLane(item);
    }
  }

  protected parkPass(item: FastPassItem): ParkPass {
    const parkAssetId = this.assets[item.facility]?.location ?? item.facility;
    const park = this.park(parkAssetId);

    return {
      type: 'APR',
      id: typelessId(item.id),
      facilityId: park.id,
      name: park.name,
      park,
      start: {
        date: item.displayStartDate ?? this.today,
      },
      guests: item.guests.map(guest => this.guest(guest)),
    };
  }

  // A DAS selection without a return time can't be shown as a plan, so it is
  // left out.
  protected dasSelection(item: FastPassItem): DasBooking | undefined {
    const { start, ...fields } = this.fastPassFields(item);

    if (!(start instanceof DateTime)) {
      return undefined;
    }

    const isInPark = item.kind === 'DAS';

    return {
      type: 'DAS',
      subtype: isInPark ? 'IN_PARK' : 'ADVANCE',
      cancellable: item.cancellable && isInPark,
      ...fields,
      start,
    };
  }

  protected lightningLane(item: FastPassItem): LightningLane {
    const subtype = LIGHTNING_LANE_SUBTYPES[item.kind] ?? 'OTHER';
    const isMultiPass = subtype === 'MP';

    const booking: LightningLane = {
      type: 'LL',
      subtype,
      ...this.fastPassFields(item),
      cancellable: item.cancellable && isMultiPass,
      modifiable: item.modifiable && isMultiPass,
    };

    if (item.showStartDateTime && item.showEndDateTime) {
      booking.showTimeInfo = {
        showStartTime: DateTime.from(item.showStartDateTime).time,
        showEndTime: DateTime.from(item.showEndDateTime).time,
      };
    }

    if (item.multipleExperiences) {
      Object.assign(booking, this.originalExperienceFields(item));
      booking.choices = this.experienceChoices(item);
    }

    return booking;
  }

  // A multiple-experience Lightning Lane is listed under the experience it was
  // originally booked for, when the response says which one that was.
  protected originalExperienceFields(
    item: FastPassItem
  ): ExperienceFields | Pick<ExperienceFields, 'facilityId' | 'name'> {
    const original = item.assets.find(asset => asset.original);

    if (!original) {
      return {
        facilityId: '',
        name: '',
      };
    }

    return this.experienceFields(original.content, {
      parkId: this.assets[original.content]?.location,
    });
  }

  protected experienceChoices(item: FastPassItem): Experience[] {
    return item.assets
      .filter(asset => !asset.excluded && !asset.original)
      .map(({ content }) => {
        const asset = this.assets[content];
        const { experience } = this.experienceFields(content, {
          parkId: asset?.location,
          name: asset?.name,
        });

        return experience;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  protected boardingGroup(item: BoardingGroupItem): BoardingGroup | undefined {
    const queueAsset = this.assets[item.asset];
    const facilityAsset = queueAsset && this.assets[queueAsset.facility];

    if (!queueAsset || !facilityAsset) {
      return undefined;
    }

    return {
      ...this.experienceFields(queueAsset.facility, {
        parkId: facilityAsset.location,
        parkName: facilityAsset.name,
        name: queueAsset.name,
      }),
      type: 'BG',
      id: typelessId(item.id),
      boardingGroup: item.boardingGroup.id,
      status: item.status,
      start: {
        date: DateTime.from(item.startDateTime).date,
      },
      guests: item.guests.map(guest => this.guest(guest)),
    };
  }

  protected reservation(item: ReservationItem): Reservation | undefined {
    const activityAsset = this.assets[item.asset];
    const facilityAsset = activityAsset && this.assets[activityAsset.facility];

    if (!activityAsset || !facilityAsset) {
      return undefined;
    }

    const start = new Date(item.startDateTime);

    if (start < this.earliestReservationStart) {
      return undefined;
    }

    const parkAssetId = facilityAsset.location ?? '';
    const park = this.park(parkAssetId, this.assets[parkAssetId]?.name);
    const landName = this.assets[facilityAsset.land ?? '']?.name;

    return {
      type: 'RES',
      subtype: item.type,
      id: typelessId(item.id),
      facilityId: typelessId(activityAsset.facility),
      name: activityAsset.name,
      park,
      land: unknownLand(park, landName),
      start: DateTime.from(start),
      guests: item.guests
        .map(guest => this.guest(guest))
        .sort(compareReservationGuests),
    };
  }

  protected fastPassFields(item: FastPassItem) {
    const asset = this.assets[item.facility];

    return {
      ...this.experienceFields(item.facility, {
        parkId: asset?.location,
        name: asset?.name,
      }),
      id: typelessId(item.id),
      start: this.fastPassStart(item),
      end: fastPassEnd(item),
      guests: this.entitledGuests(item),
    };
  }

  // An entitlement from an earlier day that is still valid is listed under
  // the current park day.
  protected fastPassStart(item: FastPassItem): DateTime | BookingDate {
    const date = item.displayStartDate ?? this.today;

    if (date < this.parkDay) {
      return {
        date: this.parkDay,
      };
    }

    if (!item.displayStartTime) {
      return {
        date,
      };
    }

    return DateTime.from(`${date}T${item.displayStartTime}`);
  }

  // Lists each guest once, leaving out guests who have used every redemption.
  protected entitledGuests(item: FastPassItem): EntitledGuest[] {
    const listedGuestIds = new Set<string>();
    const guests: EntitledGuest[] = [];

    for (const itemGuest of item.guests) {
      const isListed = listedGuestIds.has(itemGuest.id);
      const isFullyRedeemed = itemGuest.redemptionsRemaining === 0;

      if (isListed || isFullyRedeemed) {
        continue;
      }

      listedGuestIds.add(itemGuest.id);
      guests.push(this.entitledGuest(itemGuest));
    }

    return guests;
  }

  protected entitledGuest(itemGuest: FastPassGuest): EntitledGuest {
    const guest: EntitledGuest = {
      ...this.guest(itemGuest),
      entitlementId: itemGuest.entitlementId,
      bookingId: itemGuest.bookingId,
    };

    if (itemGuest.redemptionsRemaining !== undefined) {
      guest.redemptions = Math.min(
        itemGuest.redemptionsRemaining,
        itemGuest.redemptionsAllowed ?? 1
      );
    }

    return guest;
  }

  protected guest(itemGuest: ItemGuest): Guest {
    const profile = this.profiles[itemGuest.id];

    if (!profile) {
      throw new Error(`missing profile for guest ${itemGuest.id}`);
    }

    const id = typelessId(itemGuest.id);
    const firstName = profile.name.firstName ?? '';
    const lastName = profile.name.lastName ?? '';

    const guest: Guest = {
      id,
      name: `${firstName} ${lastName}`.trim(),
      avatarImageUrl: avatarUrl(profile.avatarId),
      primary: id === this.primaryGuestId,
    };

    if (profile.type === 'transactional') {
      guest.transactional = true;
    }

    return guest;
  }

  protected experienceFields(
    assetId: string,
    fallback: ExperienceFallback
  ): ExperienceFields {
    const id = typelessId(assetId);
    const experience = this.experience(id, fallback);

    return {
      facilityId: id,
      name: experience.name,
      land: experience.land,
      park: experience.park,
      experience,
    };
  }

  protected experience(id: string, fallback: ExperienceFallback): Experience {
    try {
      return this.resort.experience(id);
    } catch (error) {
      if (!(error instanceof InvalidId) || !fallback.parkId) {
        throw error;
      }

      const park = this.park(fallback.parkId, fallback.parkName);

      return {
        id,
        name: fallback.name ?? 'Experience',
        park,
        land: unknownLand(park),
        type: 'A',
      };
    }
  }

  protected park(assetId: string, fallbackName = ''): Park {
    const id = typelessId(assetId);

    try {
      return this.resort.park(id);
    } catch (error) {
      if (!(error instanceof InvalidId)) {
        throw error;
      }

      return unknownPark(id, fallbackName);
    }
  }
}
