import { DateTime, ParkTime } from '@/datetime';

import { ApiClient } from './client';
import { BookingConverter } from './itinerary/booking-converter';
import type {
  BoardingGroupStatus,
  ItineraryResponse,
} from './itinerary/response';
import { Experience, Land, Park, ResortId } from './resort';

const ITINERARY_API_NAMES: Record<ResortId, string> = {
  WDW: 'wdw-itinerary-api',
  DLR: 'dlr-itinerary-web-api',
};

const ITEM_TYPES = ['FASTPASS', 'DINING', 'ACTIVITY', 'VIRTUAL_QUEUE_POSITION'];

export type Guest = {
  id: string;
  name: string;
  avatarImageUrl?: string;
  primary?: boolean;
  transactional?: boolean;
};

export type EntitledGuest = Guest & {
  entitlementId: string;
  bookingId?: string;
  redemptions?: number;
};

// A booking that applies to a whole day rather than a specific time.
export type BookingDate = {
  date: string;
  time?: undefined;
};

export type ShowTimeInfo = {
  showStartTime: ParkTime;
  showEndTime: ParkTime;
};

interface BaseBooking {
  type: string;
  subtype?: string;
  id: string;
  facilityId: string;
  name: string;
  park: Park;
  land?: Land;
  start: DateTime | BookingDate;
  end?: DateTime | BookingDate;
  cancellable?: boolean;
  modifiable?: boolean;
  guests: Guest[];
  choices?: Pick<Experience, 'id' | 'name' | 'park'>[];
}

export interface ParkPass extends BaseBooking {
  type: 'APR';
  subtype?: undefined;
  start: BookingDate;
  end?: undefined;
  cancellable?: undefined;
  modifiable?: undefined;
}

export interface LightningLane extends BaseBooking {
  type: 'LL';
  subtype: 'MP' | 'SP' | 'OTHER';
  experience: Experience;
  land: Land;
  guests: EntitledGuest[];
  showTimeInfo?: ShowTimeInfo;
}

// A Lightning Lane Multi Pass, the only kind BG1 can book and modify.
export interface LLMP extends LightningLane {
  type: 'LL';
  subtype: 'MP';
  start: DateTime;
  end: DateTime;
}

export interface DasBooking extends BaseBooking {
  type: 'DAS';
  subtype: 'IN_PARK' | 'ADVANCE';
  experience: Experience;
  land: Land;
  start: DateTime;
  modifiable?: undefined;
  guests: EntitledGuest[];
}

export interface Reservation extends BaseBooking {
  type: 'RES';
  subtype: 'DINING' | 'ACTIVITY';
  land: Land;
  start: DateTime;
  end?: undefined;
  cancellable?: undefined;
  modifiable?: undefined;
}

export interface BoardingGroup extends BaseBooking {
  type: 'BG';
  subtype?: undefined;
  experience: Experience;
  land: Land;
  boardingGroup: number;
  status: BoardingGroupStatus;
  start: BookingDate;
  cancellable?: undefined;
  modifiable?: undefined;
}

export type Booking =
  LightningLane | DasBooking | Reservation | BoardingGroup | ParkPass;

export function isLLMP(booking: Booking): booking is LLMP {
  return booking.type === 'LL' && booking.subtype === 'MP';
}

export function isDAS(booking: Booking): booking is DasBooking {
  return booking.type === 'DAS' && booking.subtype === 'IN_PARK';
}

export class ItineraryClient extends ApiClient {
  onRefresh: (bookings: Booking[]) => void = () => undefined;

  // Returns the guest's plans from today on, in chronological order.
  async plans(): Promise<Booking[]> {
    const { swid } = this.auth.getData();
    const apiName = ITINERARY_API_NAMES[this.resort.id];
    const itemTypes = ITEM_TYPES.map(type => `item-types=${type}`).join('&');

    const { data } = await this.request<ItineraryResponse>({
      path: `/plan/${apiName}/api/v1/itinerary-items/${swid}?${itemTypes}`,
      params: {
        destination: this.resort.id,
        fields: 'items,profiles,assets,loggedInGuestId',
        'guest-locators': `${swid};type=swid`,
        'guest-locator-groups': 'MY_FAMILY',
        'start-date': DateTime.now().date,
        'show-friends': 'false',
      },
      ignoreUnauth: true,
    });

    const bookings = new BookingConverter(this.resort, data).bookings();
    this.onRefresh(bookings);

    return bookings;
  }
}
