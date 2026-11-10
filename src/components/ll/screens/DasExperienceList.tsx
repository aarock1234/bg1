import { use, useEffect, useState } from 'react';

import { Experience } from '@/api/das';
import { ExperienceType, Park } from '@/api/resort';
import Button from '@/components/Button';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import { DateTime, ParkTime } from '@/datetime';
import useDataLoader from '@/hooks/useDataLoader';

const SECONDS_PER_MINUTE = 60;

type SublistInfo = {
  heading: string;
  type: ExperienceType;
};

const SUBLISTS: SublistInfo[] = [
  {
    heading: 'Attractions',
    type: 'A',
  },
  {
    heading: 'Characters',
    type: 'C',
  },
  {
    heading: 'Entertainment',
    type: 'E',
  },
];

type SelectExperience = (experience: Experience) => void;

type DasExperienceListProps = {
  park: Park;
  onSelect: SelectExperience;
};

type ExperienceSublistsProps = {
  park: Park;

  // Undefined until the experiences have loaded.
  experiences: Experience[] | undefined;
  onSelect: SelectExperience;
};

type SublistProps = {
  park: Park;
  experiences: Experience[];
  heading: string;
  onSelect: SelectExperience;
};

function minutesUntil(time: ParkTime, now: ParkTime): number {
  return Math.round((+time - +now) / SECONDS_PER_MINUTE);
}

function Sublist({ park, experiences, heading, onSelect }: SublistProps) {
  if (experiences.length === 0) {
    return null;
  }

  const now = DateTime.now().time;

  return (
    <div className={`mt-4 rounded-sm overflow-hidden ${park.theme.bg}`}>
      <h3 className="mt-0 py-1 text-white text-xs font-semibold text-center uppercase">
        {heading}
      </h3>
      <ul className="bg-white/90 leading-snug">
        {experiences.map(experience => (
          <li className="flex items-center pt-3 last:pb-3" key={experience.id}>
            <div className="flex-1 px-2">{experience.name}</div>
            <div className="px-2">
              <Button onClick={() => onSelect(experience)}>
                <span className="min-w-16">
                  {minutesUntil(experience.time, now)}{' '}
                  <abbr title="minutes">min.</abbr>
                </span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExperienceSublists({
  park,
  experiences,
  onSelect,
}: ExperienceSublistsProps) {
  if (!experiences) {
    return null;
  }

  if (experiences.length === 0) {
    return <p>No DAS experiences available</p>;
  }

  return SUBLISTS.map(({ heading, type }) => (
    <Sublist
      park={park}
      experiences={experiences.filter(experience => experience.type === type)}
      heading={heading}
      onSelect={onSelect}
      key={type}
    />
  ));
}

export default function DasExperienceList({
  park,
  onSelect,
}: DasExperienceListProps) {
  const { das } = use(ClientsContext);
  const { loadData, loaderElem } = useDataLoader();
  const [experiences, setExperiences] = useState<Experience[]>();

  useEffect(() => {
    loadData(async () => {
      const parkExperiences = await das.experiences(park);
      const availableExperiences = parkExperiences
        .filter(experience => experience.available && !!experience.time)
        .sort((a, b) => a.name.localeCompare(b.name));

      setExperiences(availableExperiences);
    });
  }, [park, das, loadData]);

  return (
    <Screen title="Select Experience" theme={park.theme}>
      <ExperienceSublists
        park={park}
        experiences={experiences}
        onSelect={onSelect}
      />
      {loaderElem}
    </Screen>
  );
}
