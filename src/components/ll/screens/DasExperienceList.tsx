import { use, useEffect, useState } from 'react';

import { Experience } from '@/api/das';
import { ExperienceType, Park } from '@/api/resort';
import Button from '@/components/Button';
import Screen from '@/components/Screen';
import ClientsContext from '@/contexts/ClientsContext';
import { DateTime, ParkTime } from '@/datetime';
import useDataLoader from '@/hooks/useDataLoader';
import ChevronRightIcon from '@/icons/ChevronRightIcon';

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
  // Undefined until the experiences have loaded.
  experiences: Experience[] | undefined;
  onSelect: SelectExperience;
};

type SublistProps = {
  experiences: Experience[];
  heading: string;
  onSelect: SelectExperience;
};

type WaitButtonProps = {
  minutes: number;
  onClick: () => void;
};

function minutesUntil(time: ParkTime, now: ParkTime): number {
  return Math.round((+time - +now) / SECONDS_PER_MINUTE);
}

// Selects an experience. Its label is how long the party would wait for the
// return time.
function WaitButton({ minutes, onClick }: WaitButtonProps) {
  return (
    <Button
      className="min-w-24 justify-between pr-2 tabular-nums"
      onClick={onClick}
    >
      <span>
        {minutes}{' '}
        <abbr title="minutes" className="text-[13px] font-normal text-muted">
          min.
        </abbr>
      </span>
      <ChevronRightIcon className="w-4 text-muted" />
    </Button>
  );
}

function Sublist({ experiences, heading, onSelect }: SublistProps) {
  if (experiences.length === 0) {
    return null;
  }

  const now = DateTime.now().time;

  return (
    <section>
      <h3 className="section-title">{heading}</h3>
      <ul className="list">
        {experiences.map(experience => (
          <li className="row" key={experience.id}>
            <div className="row-title leading-snug">{experience.name}</div>
            <WaitButton
              minutes={minutesUntil(experience.time, now)}
              onClick={() => onSelect(experience)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExperienceSublists({
  experiences,
  onSelect,
}: ExperienceSublistsProps) {
  if (!experiences) {
    return null;
  }

  if (experiences.length === 0) {
    return <p className="empty-state">No DAS experiences available</p>;
  }

  return SUBLISTS.map(({ heading, type }) => (
    <Sublist
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
      <ExperienceSublists experiences={experiences} onSelect={onSelect} />
      {loaderElem}
    </Screen>
  );
}
