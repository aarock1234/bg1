import { Experience, FlexExperience, ParkHours } from '@/api/ll';
import { Park, Experience as ResortExperience } from '@/api/resort';
import { ParkTime } from '@/datetime';

import { minutesFromNow } from '../clock';

export const PARK_HOURS: ParkHours = {
  openTime: new ParkTime(8),
  closeTime: new ParkTime(22),
};

const WAIT_STEP_MINUTES = 5;

// How many of a park's shows the preview lists.
const MAX_SHOWS = 8;

// What makes an attraction worth looking at in the preview. The most popular
// attractions each get one of these, so the list shows every state there is.
type FeaturedState = {
  standbyWait?: number;

  // How far away the next Lightning Lane return time is. Without one, the
  // Lightning Lane is sold out.
  returnInMinutes?: number;

  isDown?: boolean;
  experienced?: boolean;
};

const FEATURED_STATES: FeaturedState[] = [
  {
    standbyWait: 75,
    returnInMinutes: 240,
  },
  {
    standbyWait: 60,
    returnInMinutes: 150,
  },
  // A long standby wait with a return time this close is a Lightning Pick.
  {
    standbyWait: 55,
    returnInMinutes: 15,
  },
  {
    standbyWait: 45,
  },
  {
    isDown: true,
    returnInMinutes: 40,
  },
  {
    standbyWait: 20,
    returnInMinutes: 25,
    experienced: true,
  },
];

// Returns a number below `modulo` that is always the same for the same ID,
// which gives each experience its own, stable data.
function variation(id: string, modulo: number): number {
  let sum = 0;

  for (const character of id) {
    sum += character.charCodeAt(0);
  }

  return sum % modulo;
}

function typicalState(experience: ResortExperience): FeaturedState {
  const averageWait = experience.avgWait ?? 10;
  const wait = averageWait + variation(experience.id, 4) * WAIT_STEP_MINUTES;

  return {
    standbyWait: wait - (wait % WAIT_STEP_MINUTES),
    returnInMinutes: 10 + variation(experience.id, 9) * 10,
  };
}

function flexExperience(
  experience: ResortExperience,
  park: Park,
  rank: number
): FlexExperience {
  const state = FEATURED_STATES[rank] ?? typicalState(experience);
  const { returnInMinutes } = state;

  return {
    ...experience,
    park,
    standby: state.isDown
      ? {
          available: false,
          unavailableReason: 'TEMPORARILY_DOWN',
        }
      : {
          available: true,
          waitTime: state.standbyWait,
        },
    flex: {
      available: returnInMinutes !== undefined,
      nextAvailableTime:
        returnInMinutes === undefined
          ? undefined
          : minutesFromNow(returnInMinutes),
    },
    experienced: state.experienced,
  };
}

// The attractions without Lightning Lane Multi Pass: the first sells its own
// Lightning Lane, the second only has a virtual queue, and the rest are
// standby only.
function standbyExperience(
  experience: ResortExperience,
  park: Park,
  index: number
): Experience {
  if (index === 0) {
    return {
      ...experience,
      park,
      standby: {
        available: true,
        waitTime: 85,
      },
      individual: {
        available: true,
        displayPrice: '$22',
        nextAvailableTime: minutesFromNow(95),
      },
    };
  }

  if (index === 1) {
    return {
      ...experience,
      park,
      standby: {
        available: false,
        unavailableReason: 'NOT_STANDBY_ENABLED',
      },
      virtualQueue: {
        available: true,
        nextAvailableTime: new ParkTime(13),
      },
    };
  }

  return {
    ...experience,
    park,
    standby: {
      available: true,
      waitTime:
        index % 4 === 0 ? undefined : typicalState(experience).standbyWait,
    },
  };
}

function byPriorityThenName(a: ResortExperience, b: ResortExperience): number {
  return (
    (a.priority ?? Infinity) - (b.priority ?? Infinity) ||
    a.name.localeCompare(b.name)
  );
}

function isAttraction(experience: ResortExperience): boolean {
  return experience.type === 'A';
}

// Returns the park's Lightning Lane Multi Pass attractions, most popular
// first.
export function rankedFlexAttractions(
  parkExperiences: ResortExperience[]
): ResortExperience[] {
  return parkExperiences
    .filter(isAttraction)
    .filter(experience => experience.priority !== undefined)
    .sort(byPriorityThenName);
}

// Builds what Disney's experience list would report for a park right now.
export function liveExperiences(
  parkExperiences: ResortExperience[],
  park: Park
): Experience[] {
  const otherAttractions = parkExperiences
    .filter(isAttraction)
    .filter(experience => experience.priority === undefined);

  return [
    ...rankedFlexAttractions(parkExperiences).map((experience, rank) => {
      return flexExperience(experience, park, rank);
    }),
    ...otherAttractions.map((experience, index) => {
      return standbyExperience(experience, park, index);
    }),
  ];
}

// Builds a few of the park's shows, each with two upcoming show times.
export function liveShows(
  parkExperiences: ResortExperience[],
  park: Park
): Record<string, Experience> {
  const shows = parkExperiences
    .filter(experience => !isAttraction(experience))
    .slice(0, MAX_SHOWS);
  const showsById: Record<string, Experience> = {};

  shows.forEach((show, index) => {
    const firstShowInMinutes = 20 + index * 15;

    showsById[show.id] = {
      ...show,
      park,
      standby: {
        available: true,
      },
      showTimes: [
        minutesFromNow(firstShowInMinutes),
        minutesFromNow(firstShowInMinutes + 120),
      ],
    };
  });

  return showsById;
}
