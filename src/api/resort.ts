import { ParkTime } from '@/datetime';

export const RESORT_IDS = ['WDW', 'DLR'] as const;

export type ResortId = (typeof RESORT_IDS)[number];

export const RESORT_TIME_ZONES: Record<ResortId, string> = {
  WDW: 'America/New_York',
  DLR: 'America/Los_Angeles',
};

export type ExperienceType = 'A' | 'E' | 'C' | 'H' | 'P';

type GeoBounds = {
  n: number;
  s: number;
  e: number;
  w: number;
};

export type Park = {
  id: string;
  name: string;
  icon: string;
  geo: GeoBounds;
  color: string;
  dropTimes: ParkTime[];
};

export type Land = {
  name: string;
  sort: number;
  color: string;
  park: Park;
};

export type Experience = {
  id: string;
  name: string;
  land: Land;
  park: Park;
  geo?: readonly [number, number];
  type: ExperienceType;
  avgWait?: number;
  tier?: number;
  priority?: number;
  dropTimes?: ParkTime[];
  highlight?: boolean;
};

type ParkData = Omit<Park, 'dropTimes'>;

type LandData = Omit<Land, 'park'> & {
  park: ParkData;
};

export type ExperienceData = Omit<
  Experience,
  'id' | 'land' | 'park' | 'dropTimes'
> & {
  land: LandData;
  dropTimes?: string[];
};

// A null entry marks an experience BG1 knows about but deliberately ignores.
export type ResortData = {
  parks: ParkData[];
  experiences: Record<string | number, ExperienceData | null | undefined>;
};

export class InvalidId extends Error {
  name = 'InvalidId';

  constructor(id: string) {
    super(`Invalid ID: ${id}`);
  }
}

function uniqueSortedTimes(times: ParkTime[]): ParkTime[] {
  const timesByValue = new Map(times.map(time => [+time, time]));

  return [...timesByValue.values()].sort((a, b) => +a - +b);
}

// A resort's parks, lands, and experiences. The data objects passed in are
// completed in place (parks, parsed times) rather than copied, so each park
// and land stays a single shared object that can be compared by identity.
export class Resort {
  readonly id: ResortId;
  readonly parks: Park[];
  protected parksById = new Map<string, Park>();
  protected landsByData = new Map<LandData, Land>();
  protected experiencesById = new Map<string, Experience | null>();
  protected dropExperiencesByPark = new Map<Park, Experience[]>();

  constructor(id: ResortId, data: ResortData) {
    this.id = id;
    this.parks = data.parks.map(parkData => this.completePark(parkData));

    for (const [experienceId, experienceData] of Object.entries(
      data.experiences
    )) {
      if (experienceData === undefined) {
        continue;
      }

      this.experiencesById.set(
        experienceId,
        experienceData && this.completeExperience(experienceId, experienceData)
      );
    }

    for (const park of this.parks) {
      this.collectDropTimes(park);
    }
  }

  experience(id: string): Experience {
    const experience = this.experiencesById.get(id);

    if (experience) {
      return experience;
    }

    if (experience === undefined) {
      console.warn(`missing experience: ${id}`);
    }

    throw new InvalidId(id);
  }

  park(id: string): Park {
    const park = this.parksById.get(id);

    if (!park) {
      throw new InvalidId(id);
    }

    return park;
  }

  // Returns the park's experiences that release extra availability at set
  // times, sorted by name.
  dropExperiences(park: Park): Experience[] {
    return this.dropExperiencesByPark.get(park) ?? [];
  }

  protected completePark(data: ParkData): Park {
    const park = Object.assign(data, {
      dropTimes: [],
    });

    this.parksById.set(park.id, park);
    this.dropExperiencesByPark.set(park, []);

    return park;
  }

  protected completeLand(data: LandData): Land {
    const existingLand = this.landsByData.get(data);

    if (existingLand) {
      return existingLand;
    }

    const land = Object.assign(data, {
      park: this.park(data.park.id),
    });

    this.landsByData.set(data, land);

    return land;
  }

  protected completeExperience(id: string, data: ExperienceData): Experience {
    const land = this.completeLand(data.land);

    const experience = Object.assign(data, {
      id,
      land,
      park: land.park,
      dropTimes: data.dropTimes?.map(ParkTime.from),
    });

    if (experience.dropTimes) {
      this.dropExperiencesByPark.get(land.park)?.push(experience);
    }

    return experience;
  }

  protected collectDropTimes(park: Park): void {
    const dropExperiences = this.dropExperiences(park);

    dropExperiences.sort((a, b) => a.name.localeCompare(b.name));

    park.dropTimes = uniqueSortedTimes(
      dropExperiences.flatMap(experience => experience.dropTimes ?? [])
    );
  }
}

export async function loadResort(id: ResortId): Promise<Resort> {
  const data: ResortData = await import(`./data/${id.toLowerCase()}.ts`);

  return new Resort(id, data);
}
