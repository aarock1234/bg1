// The shape of Disney's itinerary API response, limited to the fields BG1
// reads.

export type Asset = {
  id: string;
  type: string;
  name: string;
  media: {
    small: {
      transcodeTemplate: string;
      url: string;
    };
  };
  facility: string;
  land?: string;
  location?: string;
};

export type ItemGuest = {
  id: string;
};

export type FastPassGuest = ItemGuest & {
  bookingId: string;
  entitlementId: string;
  redemptionsRemaining?: number;
  redemptionsAllowed?: number;
};

export type FastPassAsset = {
  content: string;
  excluded: boolean;
  original: boolean;
};

export type FastPassItem = {
  id: string;
  type: 'FASTPASS';
  kind: string;
  facility: string;
  assets: FastPassAsset[];
  displayStartDate?: string;
  displayStartTime?: string;
  displayEndDate?: string;
  displayEndTime?: string;
  cancellable: boolean;
  modifiable: boolean;
  multipleExperiences: boolean;
  guests: FastPassGuest[];
  showStartDateTime?: string;
  showEndDateTime?: string;
};

export type ReservationItem = {
  id: string;
  type: 'DINING' | 'ACTIVITY';
  startDateTime: string;
  guests: ItemGuest[];
  asset: string;
};

export type BoardingGroupStatus =
  'IN_PROGRESS' | 'SUMMONED' | 'EXPIRED' | 'RELEASED' | 'OTHER';

export type BoardingGroupItem = {
  id: string;
  type: 'VIRTUAL_QUEUE_POSITION';
  status: BoardingGroupStatus;
  startDateTime: string;
  boardingGroup: {
    id: number;
  };
  guests: ItemGuest[];
  asset: string;
};

export type UnsupportedItem = {
  type: undefined;
};

export type ItineraryItem =
  FastPassItem | ReservationItem | BoardingGroupItem | UnsupportedItem;

export type Profile = {
  id: string;
  name: {
    firstName?: string;
    lastName?: string;
  };
  avatarId: string;
  type: 'registered' | 'transactional';
};

export type ItineraryResponse = {
  loggedInGuestId?: string;
  assets?: Record<string, Asset | undefined>;
  items?: ItineraryItem[];
  profiles?: Record<string, Profile | undefined>;
};
