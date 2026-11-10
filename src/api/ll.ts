import { DateTime, ParkTime, parkDate } from '@/datetime';
import { JsonOK } from '@/fetch';
import kvdb from '@/kvdb';

import { avatarUrl } from './avatar';
import { ApiClient, ApiClientOptions, ApiRequest } from './client';
import { Booking, LLMP, isLLMP } from './itinerary';
import {
  Experience as ExperienceData,
  InvalidId,
  Park,
  Resort,
} from './resort';

export type { LLMP };

export const BOOKINGS_KEY = 'bg1.ll.bookings';

// How long a booking request may take. It gets longer than other requests
// because giving up on one that Disney goes on to complete leaves the guest
// with a Lightning Lane they were told they didn't get.
export const BOOKING_TIMEOUT_MS = 20_000;

const TIME_PATTERN = /^\d{2}:\d{2}:\d{2}$/;

// Sorts guests with no known eligibility time after those who have one.
const NEVER_ELIGIBLE = 24 * 60 * 60;

type Standby = {
  available?: boolean;
  unavailableReason?:
    'TEMPORARILY_DOWN' | 'NOT_STANDBY_ENABLED' | 'NO_MORE_SHOWS' | 'CLOSED';
  waitTime?: number;
};

type ApiExperience = {
  id: string;
  type: 'ATTRACTION' | 'ENTERTAINMENT';
  standby: Standby & {
    nextShowTime?: string;
  };
  additionalShowTimes?: string[];
  flex?: {
    available?: boolean;
    nextAvailableTime?: string;
    enrollmentStartTime?: string;
  };
  individual?: {
    available: boolean;
    displayPrice: string;
    nextAvailableTime?: string;
  };
  virtualQueue?: {
    available: boolean;
    nextAvailableTime?: string;
  };
};

type EligibilityWindow = {
  time: {
    time: string;
    timeDisplayString: string;
    timeStatus: 'NOW' | 'LATER';
  };
  guestIds: string[];
};

type ExperiencesResponse = {
  availableExperiences: ApiExperience[];
  eligibility?: {
    geniePlusEligibility?: Record<
      string,
      {
        flexEligibilityWindows?: EligibilityWindow[];
      }
    >;
    guestIds: string[];
  };
};

// The type of `T` after withParkTimes has parsed its time fields.
type WithParkTimes<T> = T extends object
  ? {
      [K in keyof T]: K extends `${string}Time`
        ? T[K] extends string | undefined
          ? ParkTime
          : WithParkTimes<T[K]>
        : K extends `${string}Times`
          ? ParkTime[]
          : WithParkTimes<T[K]>;
    }
  : T;

export type Experience = ExperienceData &
  Omit<
    WithParkTimes<ApiExperience>,
    'type' | 'standby' | 'additionalShowTimes'
  > & {
    standby: Standby;
    experienced?: boolean;
    showTimes?: ParkTime[];
  };

export type FlexExperience = Experience & Required<Pick<Experience, 'flex'>>;

export type OfferExperience = Omit<Experience, 'standby'>;

export type IneligibleReason =
  | 'INVALID_PARK_ADMISSION'
  | 'PARK_RESERVATION_NEEDED'
  | 'GENIE_PLUS_NEEDED'
  | 'EXPERIENCE_LIMIT_REACHED'
  | 'TOO_EARLY'
  | 'TOO_EARLY_FOR_PARK_HOPPING'
  | 'NOT_IN_PARTY'
  | 'MULTI_PASS_NEEDED'
  | 'REDEMPTION_NEEDED'
  | 'TIER_LIMIT_REACHED'
  | 'TOO_EARLY_FOR_NEXT_PARK';

export type OrderDetails = {
  externalIdentifier: {
    id: string;
    idType: string;
  };
  orderId: string;
  orderItemId: string;
};

export type Guest = {
  id: string;
  name: string;
  primary?: boolean;
  avatarImageUrl?: string;
  transactional?: boolean;
  orderDetails?: OrderDetails;
  ineligibleReason?: IneligibleReason;
  eligibleAfter?: ParkTime;
};

export type Guests = {
  eligible: Guest[];
  ineligible: Guest[];
};

export type ApiGuest = {
  id: string;
  firstName?: string;
  lastName?: string;
  primary?: boolean;
  characterId?: string;
  orderDetails?: OrderDetails;
  ineligibleReason?: IneligibleReason;
  eligibleAfter?: string;
};

export type GuestsResponse = {
  guests: ApiGuest[];
  ineligibleGuests: ApiGuest[];
};

type Overlap = {
  contains: (time: ParkTime) => boolean;
};

// Another plan on the guest's day, shown alongside an offer so that
// overlapping return times stand out.
export type OfferItineraryItem = {
  overlap: Overlap;
  facilityId: string;
  startTime: ParkTime;
  endTime?: ParkTime;
  showTimeInfo?: {
    showStartTime: ParkTime;
    showEndTime: ParkTime;
  };
};

export type ParkHours = {
  openTime: ParkTime;
  closeTime: ParkTime;
};

// A return window Disney is holding for the party. `booking` is the existing
// Lightning Lane when the offer would modify one.
export type Offer<B = LLMP | undefined> = {
  id: string;
  start: DateTime;
  end: DateTime;
  changed?: boolean;
  guests: Guests;
  experience: OfferExperience;
  itinerary: OfferItineraryItem[];
  parkHours?: ParkHours;
  offerSetId?: string;
  booking: B;
};

export type OfferOptions<B> =
  | {
      date: string;
    }
  | {
      booking?: B;
    };

// Available return times, grouped by hour.
export type HourlyTimes = ParkTime[][];

// What each resort's Lightning Lane system supports.
export type LLRules = {
  maxPartySize: number;

  // A booking can be moved to an experience in another park.
  parkModify: boolean;

  // Lightning Lanes can be booked for a future date.
  prebook: boolean;

  // The guest can choose a return time instead of taking the next one.
  timeSelect: boolean;
};

export type LLClientOptions = ApiClientOptions & {
  tracker?: Public<LLTracker>;
};

type LLRequest = ApiRequest & {
  // Adds the logged-in guest's ID to the query string.
  userId?: boolean;
};

type LLTrackerData = {
  booked: string[];
  experienced: string[];
};

export class ModifyNotAllowed extends Error {
  name = 'ModifyNotAllowed';
}

export class OfferError extends Error {
  readonly name = 'OfferError';

  constructor(readonly guests: Guests) {
    super('Offer request failed');
  }
}

export function throwOnNotModifiable(booking?: Booking): void {
  if (booking && !booking.modifiable) {
    throw new ModifyNotAllowed();
  }
}

// Returns a copy of API data in which every `HH:MM:SS` string held in a field
// named `...Time` is a ParkTime.
export function withParkTimes<T extends object>(data: T): WithParkTimes<T> {
  const entries = Object.entries(data).map(([key, value]) => {
    return [key, withParkTime(key, value)];
  });

  return Object.fromEntries(entries);
}

function withParkTime(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    const isTime = key.endsWith('Time') && TIME_PATTERN.test(value);

    return isTime ? ParkTime.from(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map(item => withParkTime('', item));
  }

  if (typeof value === 'object' && value !== null) {
    return withParkTimes(value);
  }

  return value;
}

function earliestBookTime(response: ExperiencesResponse): ParkTime | undefined {
  const eligibility = response.eligibility?.geniePlusEligibility?.[parkDate()];
  const windows = eligibility?.flexEligibilityWindows ?? [];
  const [earliestTime] = windows.map(window => window.time.time).sort();

  if (!earliestTime) {
    return undefined;
  }

  return ParkTime.from(earliestTime);
}

function showTimes(experience: ApiExperience): ParkTime[] | undefined {
  const { nextShowTime } = experience.standby ?? {};

  if (!nextShowTime) {
    return undefined;
  }

  const additionalShowTimes = experience.additionalShowTimes ?? [];

  return [nextShowTime, ...additionalShowTimes].map(ParkTime.from);
}

function hasReason(guest: Guest, reason: IneligibleReason): number {
  return Number(guest.ineligibleReason === reason);
}

function reasonFirst(a: Guest, b: Guest, reason: IneligibleReason): number {
  return hasReason(b, reason) - hasReason(a, reason);
}

function reasonLast(a: Guest, b: Guest, reason: IneligibleReason): number {
  return hasReason(a, reason) - hasReason(b, reason);
}

function eligibleAfterValue(guest: Guest): number {
  if (!guest.eligibleAfter) {
    return NEVER_ELIGIBLE;
  }

  return +guest.eligibleAfter;
}

// Orders ineligible guests so the ones closest to booking come first: by when
// they become eligible, then with guests outside the party or without Multi
// Pass last. Ties go to the primary guest, then by name.
function compareIneligibleGuests(a: Guest, b: Guest): number {
  const byPrimaryThenName =
    Number(!a.primary) - Number(!b.primary) || a.name.localeCompare(b.name);

  if (a.eligibleAfter || b.eligibleAfter) {
    return eligibleAfterValue(a) - eligibleAfterValue(b) || byPrimaryThenName;
  }

  if (a.ineligibleReason === b.ineligibleReason) {
    return byPrimaryThenName;
  }

  return (
    reasonLast(a, b, 'NOT_IN_PARTY') ||
    reasonLast(a, b, 'MULTI_PASS_NEEDED') ||
    reasonFirst(a, b, 'EXPERIENCE_LIMIT_REACHED') ||
    byPrimaryThenName
  );
}

function isTrackerData(stored: unknown): stored is LLTrackerData {
  if (typeof stored !== 'object' || stored === null) {
    return false;
  }

  return (
    'booked' in stored &&
    Array.isArray(stored.booked) &&
    'experienced' in stored &&
    Array.isArray(stored.experienced)
  );
}

export abstract class LLClient extends ApiClient {
  readonly rules: LLRules = {
    maxPartySize: 12,
    parkModify: false,
    prebook: false,
    timeSelect: false,
  };

  // The earliest time today that any guest can book another Lightning Lane.
  nextBookTime: ParkTime | undefined;

  protected partyIds = new Set<string>();
  protected tracker: Public<LLTracker>;
  #lastOffer: Offer | null = null;

  constructor(resort: Resort, options: LLClientOptions = {}) {
    super(resort, options);
    this.tracker = options.tracker ?? new LLTracker();
  }

  get lastOffer(): Offer | null {
    return this.#lastOffer;
  }

  // Limits bookings to the given guests; everyone else is reported as
  // ineligible. An empty list removes the limit.
  setPartyIds(partyIds: string[]): void {
    this.partyIds = new Set(partyIds);
  }

  async experiences(park: Park, date: string): Promise<Experience[]> {
    const parkId = encodeURIComponent(park.id);

    const { data } = await this.request<ExperiencesResponse>({
      path: `/tipboard-vas/planning/v1/parks/${parkId}/experiences/`,
      params: {
        date,
      },
      userId: true,
    });

    this.nextBookTime = earliestBookTime(data);

    return data.availableExperiences.flatMap(apiExperience => {
      return this.experience(apiExperience, park) ?? [];
    });
  }

  track(bookings: Booking[]): void {
    this.tracker.update(bookings, this);
  }

  abstract guests(
    experience?: Pick<Experience, 'id'>,
    date?: string
  ): Promise<Guests>;

  abstract offer<B extends Offer['booking']>(
    experience: OfferExperience,
    guests: Guest[],
    options?: OfferOptions<B>
  ): Promise<Offer<B>>;

  abstract times(offer: Offer): Promise<HourlyTimes>;

  abstract changeOfferTime<B extends Offer['booking']>(
    offer: Offer<B>,
    time: ParkTime
  ): Promise<Offer<B>>;

  abstract book<B extends Offer['booking']>(
    offer: Offer<B>,
    guestsToModify?: Pick<Guest, 'id'>[]
  ): Promise<LLMP>;

  async cancelBooking(guests: LLMP['guests']): Promise<void> {
    const entitlementIds = guests
      .map(guest => encodeURIComponent(guest.entitlementId))
      .join(',');

    await this.request({
      path: `/ea-vas/api/v1/entitlements/${entitlementIds}`,
      method: 'DELETE',
    });
  }

  protected request<T>(request: LLRequest): Promise<JsonOK<T>> {
    const { userId, ...apiRequest } = request;

    if (!userId) {
      return super.request<T>(apiRequest);
    }

    const { swid } = this.auth.getData();

    return super.request<T>({
      ...apiRequest,
      params: {
        ...apiRequest.params,
        userId: swid,
      },
    });
  }

  // Returns undefined for an experience that isn't in BG1's data.
  protected experience(
    apiExperience: ApiExperience,
    park: Park
  ): Experience | undefined {
    let experienceData: ExperienceData;

    try {
      experienceData = this.resort.experience(apiExperience.id);
    } catch (error) {
      if (error instanceof InvalidId) {
        return undefined;
      }

      throw error;
    }

    return {
      ...withParkTimes(apiExperience),
      ...experienceData,
      park,
      showTimes: showTimes(apiExperience),
      experienced: this.tracker.experienced(apiExperience),
    };
  }

  protected guest(apiGuest: ApiGuest): Guest {
    const { firstName, lastName, characterId, eligibleAfter, ...fields } =
      apiGuest;

    const guest: Guest = {
      ...fields,
      name: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
      avatarImageUrl: avatarUrl(characterId),
      eligibleAfter: eligibleAfter ? ParkTime.from(eligibleAfter) : undefined,
    };

    const isOutsideParty =
      this.partyIds.size > 0 && !this.partyIds.has(guest.id);

    if (isOutsideParty) {
      guest.ineligibleReason = 'NOT_IN_PARTY';
      guest.eligibleAfter = undefined;
    }

    return guest;
  }

  protected parseGuestData(data: GuestsResponse): Guests {
    const eligible: Guest[] = [];
    const ineligible = data.ineligibleGuests.map(guest => this.guest(guest));

    // A guest Disney considers eligible is still ineligible when they are
    // outside the chosen party.
    for (const apiGuest of data.guests) {
      const guest = this.guest(apiGuest);
      const group = guest.ineligibleReason ? ineligible : eligible;

      group.push(guest);
    }

    ineligible.sort(compareIneligibleGuests);

    return {
      eligible,
      ineligible,
    };
  }

  // Records the offer as the latest one and flags it as changed when its
  // return time isn't the one the guest was expecting.
  protected updateLastOffer<O extends Offer>(
    offer: O,
    expectedTime: ParkTime | undefined
  ): O {
    offer.changed = +offer.start.time !== +(expectedTime ?? offer.start.time);
    this.#lastOffer = offer;

    return offer;
  }
}

// Remembers which experiences the guest has already used a Lightning Lane on
// today, which Disney's experience list doesn't report.
export class LLTracker {
  protected bookedIds = new Set<string>();
  protected experiencedIds = new Set<string>();

  constructor() {
    this.load();
  }

  experienced(experience: Pick<Experience, 'id'>): boolean {
    return this.experiencedIds.has(experience.id);
  }

  async update(
    bookings: Booking[],
    client: Pick<LLClient, 'guests'>
  ): Promise<void> {
    this.load();

    const today = parkDate();
    const todaysBookings = bookings.filter(isLLMP).filter(booking => {
      return !!booking.cancellable && parkDate(booking.start) === today;
    });

    // A Lightning Lane that can no longer be modified has been redeemed.
    for (const booking of todaysBookings) {
      this.setExperienced(booking.experience.id, !booking.modifiable);
    }

    const previouslyBookedIds = this.bookedIds;
    this.bookedIds = new Set(
      todaysBookings.map(booking => booking.experience.id)
    );

    // A booking that has disappeared was either redeemed or cancelled. Only a
    // redeemed one counts toward the experience's limit.
    for (const experienceId of previouslyBookedIds) {
      if (this.bookedIds.has(experienceId)) {
        continue;
      }

      const { ineligible } = await client.guests({
        id: experienceId,
      });
      const isLimitReached = ineligible.some(guest => {
        return guest.ineligibleReason === 'EXPERIENCE_LIMIT_REACHED';
      });

      this.setExperienced(experienceId, isLimitReached);
    }

    this.save();
  }

  protected setExperienced(experienceId: string, isExperienced: boolean): void {
    if (isExperienced) {
      this.experiencedIds.add(experienceId);
    } else {
      this.experiencedIds.delete(experienceId);
    }
  }

  protected load(): void {
    const stored = kvdb.getDaily(BOOKINGS_KEY);
    const booked = isTrackerData(stored) ? stored.booked : [];
    const experienced = isTrackerData(stored) ? stored.experienced : [];

    this.bookedIds = new Set(booked);
    this.experiencedIds = new Set(experienced);
  }

  protected save(): void {
    const data: LLTrackerData = {
      booked: [...this.bookedIds],
      experienced: [...this.experiencedIds],
    };

    kvdb.setDaily(BOOKINGS_KEY, data);
  }
}
