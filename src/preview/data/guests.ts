import { avatarUrl } from '@/api/avatar';
import { Guest as PlanGuest } from '@/api/itinerary';
import { ApiGuest, GuestsResponse } from '@/api/ll';

import { minutesFromNow } from '../clock';

// The preview's travel party, as Disney's API describes guests. Pluto has no
// avatar, which shows how a guest's initial stands in for it.
const MICKEY: ApiGuest = {
  id: 'mickey',
  firstName: 'Mickey',
  lastName: 'Mouse',
  primary: true,
  characterId: '90004482',
};

const MINNIE: ApiGuest = {
  id: 'minnie',
  firstName: 'Minnie',
  lastName: 'Mouse',
  characterId: '90004486',
};

const PLUTO: ApiGuest = {
  id: 'pluto',
  firstName: 'Pluto',
};

const DONALD: ApiGuest = {
  id: 'donald',
  firstName: 'Donald',
  lastName: 'Duck',
  characterId: '90004104',
};

const DAISY: ApiGuest = {
  id: 'daisy',
  firstName: 'Daisy',
  lastName: 'Duck',
  characterId: '90004068',
};

export const PARTY: ApiGuest[] = [MICKEY, MINNIE, PLUTO, DONALD, DAISY];

// The guests who hold the preview's existing plans.
export const PLAN_GUESTS: PlanGuest[] = [MICKEY, MINNIE, PLUTO].map(
  toPlanGuest
);

function fullName(guest: ApiGuest): string {
  return `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim();
}

export function toPlanGuest(guest: ApiGuest): PlanGuest {
  return {
    id: guest.id,
    name: fullName(guest),
    primary: guest.primary,
    avatarImageUrl: avatarUrl(guest.characterId),
  };
}

// Three guests who can book, one without a valid ticket, and one who has to
// wait before booking again.
export function partyResponse(): GuestsResponse {
  return {
    guests: [MICKEY, MINNIE, PLUTO],
    ineligibleGuests: [
      {
        ...DONALD,
        ineligibleReason: 'INVALID_PARK_ADMISSION',
      },
      {
        ...DAISY,
        ineligibleReason: 'TOO_EARLY',
        eligibleAfter: minutesFromNow(45).toString(),
      },
    ],
  };
}

// Nobody can book: most of the party has to wait, and one has no ticket.
export function ineligiblePartyResponse(): GuestsResponse {
  const waitUntil = minutesFromNow(45).toString();

  return {
    guests: [],
    ineligibleGuests: [
      ...[MICKEY, MINNIE, PLUTO, DAISY].map(guest => {
        return {
          ...guest,
          ineligibleReason: 'TOO_EARLY' as const,
          eligibleAfter: waitUntil,
        };
      }),
      {
        ...DONALD,
        ineligibleReason: 'INVALID_PARK_ADMISSION',
      },
    ],
  };
}
