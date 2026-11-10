import {
  BoardingGroup,
  Booking,
  DasBooking,
  EntitledGuest,
  LLMP,
  LightningLane,
  ParkPass,
  Reservation,
} from '@/api/itinerary';
import { Park, Experience as ResortExperience } from '@/api/resort';
import { DateTime, ParkTime, modifyDate, parkDate } from '@/datetime';

import { minutesFromNow } from '../clock';
import { PreviewResort, experiencesIn } from '../resort';
import { rankedFlexAttractions } from './experiences';
import { PLAN_GUESTS } from './guests';

const DINING_NAMES = {
  WDW: 'Liberty Tree Tavern Lunch',
  DLR: 'Blue Bayou Restaurant',
};

function entitledGuests(bookingId: string): EntitledGuest[] {
  return PLAN_GUESTS.map(guest => {
    return {
      ...guest,
      entitlementId: `${bookingId}-${guest.id}`,
    };
  });
}

function parkPass(park: Park, date: string): ParkPass {
  return {
    type: 'APR',
    id: `pass-${park.id}-${date}`,
    facilityId: park.id,
    name: park.name,
    park,
    start: {
      date,
    },
    guests: PLAN_GUESTS,
  };
}

type LightningLaneTimes = {
  date: string;
  start: ParkTime;

  // A Lightning Lane that can no longer be modified has been redeemed or has
  // expired.
  modifiable: boolean;
};

function multiPass(
  experience: ResortExperience,
  { date, start, modifiable }: LightningLaneTimes
): LLMP {
  const id = `ll-${experience.id}-${date}`;

  return {
    type: 'LL',
    subtype: 'MP',
    id,
    facilityId: experience.id,
    name: experience.name,
    experience,
    land: experience.land,
    park: experience.park,
    start: new DateTime(date, start),
    end: new DateTime(
      date,
      start.add({
        hours: 1,
      })
    ),
    cancellable: true,
    modifiable,
    guests: entitledGuests(id),
  };
}

// A Lightning Lane that is good for any one of several attractions, as Disney
// hands out when an attraction closes.
function multipleExperiences(
  choices: ResortExperience[],
  date: string
): LightningLane | undefined {
  const [experience] = choices;

  if (!experience) {
    return undefined;
  }

  const id = `ll-choices-${date}`;

  return {
    type: 'LL',
    subtype: 'OTHER',
    id,
    facilityId: experience.id,
    name: experience.name,
    experience,
    land: experience.land,
    park: experience.park,
    start: new DateTime(date, minutesFromNow(190)),
    end: {
      date,
    },
    cancellable: false,
    modifiable: false,
    guests: entitledGuests(id).map(guest => {
      return {
        ...guest,
        redemptions: 1,
      };
    }),
    choices,
  };
}

function boardingGroup(
  experience: ResortExperience,
  date: string
): BoardingGroup {
  return {
    type: 'BG',
    id: `bg-${experience.id}`,
    facilityId: experience.id,
    name: experience.name,
    experience,
    land: experience.land,
    park: experience.park,
    boardingGroup: 42,
    status: 'SUMMONED',
    start: {
      date,
    },
    guests: PLAN_GUESTS,
  };
}

function dasReturnTime(experience: ResortExperience, date: string): DasBooking {
  const id = `das-${experience.id}`;

  return {
    type: 'DAS',
    subtype: 'IN_PARK',
    id,
    facilityId: experience.id,
    name: experience.name,
    experience,
    land: experience.land,
    park: experience.park,
    start: new DateTime(date, minutesFromNow(100)),
    cancellable: true,
    guests: entitledGuests(id),
  };
}

function diningReservation(
  near: ResortExperience,
  name: string,
  date: string
): Reservation {
  return {
    type: 'RES',
    subtype: 'DINING',
    id: `dining-${date}`,
    facilityId: 'preview-restaurant',
    name,
    land: near.land,
    park: near.park,
    start: new DateTime(date, minutesFromNow(145)),
    guests: PLAN_GUESTS,
  };
}

// Builds a day in the resort's first park with one plan of every kind, and a
// second day in its next park.
export function seedPlans(previewResort: PreviewResort): Booking[] {
  const { resort } = previewResort;
  const [firstPark, secondPark] = resort.parks;

  if (!firstPark) {
    return [];
  }

  const today = parkDate();
  const tomorrow = modifyDate(today, 1);
  const attractions = rankedFlexAttractions(
    experiencesIn(previewResort, firstPark)
  );
  const [, , , , , expired, booked, queued, accessible] = attractions;
  const plans: (Booking | undefined)[] = [parkPass(firstPark, today)];

  if (expired && booked && queued && accessible) {
    plans.push(
      multiPass(expired, {
        date: today,
        start: new ParkTime(9),
        modifiable: false,
      }),
      multiPass(booked, {
        date: today,
        start: minutesFromNow(65),
        modifiable: true,
      }),
      boardingGroup(queued, today),
      dasReturnTime(accessible, today),
      diningReservation(booked, DINING_NAMES[resort.id], today),
      multipleExperiences(attractions.slice(0, 4), today)
    );
  }

  if (secondPark) {
    const [headliner] = rankedFlexAttractions(
      experiencesIn(previewResort, secondPark)
    );

    plans.push(
      parkPass(secondPark, tomorrow),
      headliner &&
        multiPass(headliner, {
          date: tomorrow,
          start: new ParkTime(9, 30),
          modifiable: true,
        })
    );
  }

  return plans.flatMap(plan => plan ?? []);
}

// Whole-day plans, which have no time, sort before the day's timed plans.
function startValue(plan: Booking): string {
  return `${plan.start.date}T${plan.start.time ?? ''}`;
}

// The guest's plans, standing in for Disney's itinerary. Bookings made and
// cancelled in the preview show up here, as they would in the real app.
export class PlanBook {
  protected plans: Booking[];

  constructor(plans: Booking[]) {
    this.plans = plans;
  }

  list(): Booking[] {
    return [...this.plans].sort((a, b) => {
      return startValue(a).localeCompare(startValue(b));
    });
  }

  add(plan: Booking): void {
    this.plans.push(plan);
  }

  remove(planId: string): void {
    this.plans = this.plans.filter(plan => plan.id !== planId);
  }

  // Cancels the given guests' entitlements. A plan nobody holds anymore is
  // gone.
  removeGuests(guests: EntitledGuest[]): void {
    const cancelledIds = new Set(guests.map(guest => guest.entitlementId));
    const remainingPlans: Booking[] = [];

    for (const plan of this.plans) {
      if (plan.type !== 'LL' && plan.type !== 'DAS') {
        remainingPlans.push(plan);
        continue;
      }

      const remainingGuests = plan.guests.filter(guest => {
        return !cancelledIds.has(guest.entitlementId);
      });

      if (remainingGuests.length > 0) {
        remainingPlans.push({
          ...plan,
          guests: remainingGuests,
        });
      }
    }

    this.plans = remainingPlans;
  }
}
