import { Park } from '@/api/resort';
import { Guest, Queue } from '@/api/vq';

// One queue of each kind: open for joining right now, opening later today, and
// closed with no opening time.
export function previewQueues(park: Park): Queue[] {
  return [
    {
      id: 'open-queue',
      name: 'TRON Lightcycle / Run',
      isAcceptingJoins: true,
      isAcceptingPartyCreation: true,
      nextScheduledOpenTime: '13:00:00',
      nextScheduledPartyCreationOpenTime: '12:00:00',
      maxPartySize: 3,
      categoryContentId: 'attraction',
      park,
    },
    {
      id: 'upcoming-queue',
      name: "Tiana's Bayou Adventure",
      isAcceptingJoins: false,
      isAcceptingPartyCreation: true,
      nextScheduledOpenTime: '13:00:00',
      nextScheduledPartyCreationOpenTime: '12:00:00',
      maxPartySize: 6,
      categoryContentId: 'attraction',
      park,
    },
    {
      id: 'closed-queue',
      name: 'Meet Santa Claus',
      isAcceptingJoins: false,
      isAcceptingPartyCreation: false,
      nextScheduledOpenTime: null,
      nextScheduledPartyCreationOpenTime: null,
      maxPartySize: 10,
      categoryContentId: 'character',
    },
  ];
}

// The guest who can't join a queue in the preview, to show a conflict.
export const GUEST_NOT_IN_PARK_ID = 'pluto';

export const QUEUE_GUESTS: Guest[] = [
  {
    id: 'mickey',
    name: 'Mickey Mouse',
    primary: true,
    preselected: true,
  },
  {
    id: 'minnie',
    name: 'Minnie Mouse',
    primary: false,
    preselected: true,
  },
  {
    id: 'donald',
    name: 'Donald Duck',
    primary: false,
    preselected: false,
  },
  {
    id: GUEST_NOT_IN_PARK_ID,
    name: 'Pluto',
    primary: false,
    preselected: false,
  },
];
