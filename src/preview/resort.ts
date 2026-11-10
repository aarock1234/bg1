import { Experience, Park, Resort, ResortData, ResortId } from '@/api/resort';

// A resort together with the list of its experiences, which Resort itself
// only hands out one at a time by ID.
export type PreviewResort = {
  resort: Resort;
  experiences: Experience[];
};

export async function loadPreviewResort(id: ResortId): Promise<PreviewResort> {
  const data: ResortData = await import(`../api/data/${id.toLowerCase()}.ts`);
  const resort = new Resort(id, data);
  const knownIds = Object.entries(data.experiences).flatMap(
    ([experienceId, experienceData]) => (experienceData ? [experienceId] : [])
  );

  return {
    resort,
    experiences: knownIds.map(experienceId => resort.experience(experienceId)),
  };
}

export function experiencesIn(
  { experiences }: PreviewResort,
  park: Park
): Experience[] {
  return experiences.filter(experience => experience.park === park);
}

// Returns the park with the given name, or the resort's first park.
export function findPark(resort: Resort, name: string | undefined): Park {
  const park = resort.parks.find(park => park.name === name) ?? resort.parks[0];

  if (!park) {
    throw new Error('resort has no parks');
  }

  return park;
}
