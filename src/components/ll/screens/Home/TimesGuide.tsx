import { memo, use } from 'react';

import { Experience } from '@/api/ll';
import { Land } from '@/api/resort';
import Button from '@/components/Button';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';
import Tab from '@/components/Tab';
import { Time } from '@/components/Time';
import DasPartiesContext from '@/contexts/DasPartiesContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import NavContext from '@/contexts/NavContext';
import ThemeContext from '@/contexts/ThemeContext';
import { ParkTime } from '@/datetime';

import DasPartyList from '../DasPartyList';
import { HomeTabProps } from '../Home';
import RefreshButton from '../RefreshButton';
import Legend, { Symbol } from './Legend';
import ParkSelect from './ParkSelect';

// Sorts experiences without a show time after every one that has a show time.
const NO_SHOW_TIME = 86_400;

type ExperienceType = Experience['type'];

type ExperiencesByType = Record<ExperienceType, Experience[]>;

type ExperienceSection = {
  type: ExperienceType;
  title: string;
};

// The sections of each land, in the order they are shown.
const EXPERIENCE_SECTIONS: readonly ExperienceSection[] = [
  {
    type: 'A',
    title: 'Attractions',
  },
  {
    type: 'E',
    title: 'Entertainment',
  },
  {
    type: 'H',
    title: 'Holiday Entertainment',
  },
  {
    type: 'C',
    title: 'Characters',
  },
  {
    type: 'P',
    title: 'Party Entertainment',
  },
];

// An experience is listed while it is open or temporarily down, while its
// individual Lightning Lane is on sale, or whenever it has a virtual queue.
function isListed(experience: Experience): boolean {
  const { standby, individual, virtualQueue } = experience;

  return !!(
    standby.available ||
    standby.unavailableReason === 'TEMPORARILY_DOWN' ||
    individual?.available ||
    virtualQueue
  );
}

function nextShowTimeValue(experience: Experience): number {
  return Number(experience.showTimes?.[0] ?? NO_SHOW_TIME);
}

function compareExperiences(a: Experience, b: Experience): number {
  return (
    a.land.sort - b.land.sort ||
    nextShowTimeValue(a) - nextShowTimeValue(b) ||
    a.name.localeCompare(b.name)
  );
}

// Groups the listed experiences by land and then by type, keeping lands and
// experiences in the order they are shown.
function groupByLand(experiences: Experience[]): Map<Land, ExperiencesByType> {
  const listedExperiences = experiences
    .filter(isListed)
    .sort(compareExperiences);
  const experiencesByLand = new Map<Land, ExperiencesByType>();

  for (const experience of listedExperiences) {
    let experiencesByType = experiencesByLand.get(experience.land);

    if (!experiencesByType) {
      experiencesByType = {
        A: [],
        E: [],
        C: [],
        H: [],
        P: [],
      };
      experiencesByLand.set(experience.land, experiencesByType);
    }

    experiencesByType[experience.type].push(experience);
  }

  return experiencesByLand;
}

export default function TimesGuide({ ref }: HomeTabProps) {
  const { goTo } = use(NavContext);
  const { experiences, refreshExperiences, loaderElem } =
    use(ExperiencesContext);
  const parties = use(DasPartiesContext);

  return (
    <Tab
      title="Times Guide"
      buttons={
        <>
          {parties.length > 0 && (
            <Button
              title="Disability Access Service"
              onClick={() => goTo(<DasPartyList parties={parties} />)}
            >
              DAS
            </Button>
          )}
          <ParkSelect />
          <RefreshButton name="Times" onClick={() => refreshExperiences()} />
        </>
      }
      ref={ref}
    >
      <Experiences experiences={experiences} />
      {loaderElem}
    </Tab>
  );
}

type ExperiencesProps = {
  experiences: Experience[];
};

const Experiences = memo(function Experiences({
  experiences,
}: ExperiencesProps) {
  const experiencesByLand = groupByLand(experiences);

  return (
    <>
      {[...experiencesByLand].map(([land, experiencesByType]) => (
        <LandTimes
          land={land}
          experiencesByType={experiencesByType}
          key={land.name}
        />
      ))}

      {experiences.length > 0 && <SymbolsLegend />}
    </>
  );
});

type LandTimesProps = {
  land: Land;
  experiencesByType: ExperiencesByType;
};

function LandTimes({ land, experiencesByType }: LandTimesProps) {
  return (
    <div>
      <h2
        className={`pr-1 ${land.theme.text} text-sm font-semibold text-right uppercase`}
      >
        {land.name}
      </h2>
      <div className="rounded-sm overflow-hidden">
        {EXPERIENCE_SECTIONS.map(({ type, title }) => (
          <ExperienceList
            title={title}
            land={land}
            experiences={experiencesByType[type]}
            key={type}
          />
        ))}
      </div>
    </div>
  );
}

type ExperienceListProps = {
  title: string;
  land: Land;
  experiences: Experience[];
};

function ExperienceList({ title, land, experiences }: ExperienceListProps) {
  if (experiences.length === 0) {
    return null;
  }

  return (
    <div className={land.theme.bg} data-testid={`${land.name}-${title}`}>
      <h3 className="mt-0 py-1 text-white text-xs font-semibold text-center uppercase">
        {title}
      </h3>
      <table className="w-full leading-snug">
        <tbody>
          {experiences.map(experience => (
            <ExperienceRow
              experience={experience}
              land={land}
              key={experience.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ExperienceRowProps = {
  experience: Experience;
  land: Land;
};

function ExperienceRow({ experience, land }: ExperienceRowProps) {
  const timeWidth = experience.showTimes
    ? 'min-w-[5.625rem]'
    : 'min-w-[2.75rem]';
  const nameStyle = experience.highlight ? `font-bold ${land.theme.text}` : '';

  return (
    <tr className="group">
      <td
        className={`${timeWidth} px-2 py-0.5 group-first:pt-1 group-last:pb-1 bg-white/80 font-bold text-center uppercase whitespace-nowrap`}
      >
        <PostedTime experience={experience} />
      </td>
      <td className="w-full px-1 pl-2 py-0.5 group-first:pt-1 group-last:pb-1 bg-white/90">
        <div className="flex items-center gap-x-2">
          <div className={`flex-1 ${nameStyle}`}>{experience.name}</div>
          <IndividualLL experience={experience} land={land} />
        </div>
      </td>
    </tr>
  );
}

type PostedTimeProps = {
  experience: Experience;
};

// Shows the experience's next show time, or else its standby wait or the
// symbol for why it has none.
function PostedTime({ experience }: PostedTimeProps) {
  const { standby, virtualQueue, showTimes = [] } = experience;
  const [nextShowTime] = showTimes;
  const isVirtualQueueOnly =
    !!virtualQueue && standby.unavailableReason === 'NOT_STANDBY_ENABLED';

  if (nextShowTime) {
    return (
      <NextShowTime
        experience={experience}
        time={nextShowTime}
        hasLaterShows={showTimes.length > 1}
      />
    );
  }

  if (standby.available) {
    return standby.waitTime ?? '–';
  }

  if (isVirtualQueueOnly) {
    return 'VQ';
  }

  return '❌';
}

type NextShowTimeProps = {
  experience: Experience;
  time: ParkTime;
  hasLaterShows: boolean;
};

// Links to the full list of show times when there are later shows.
function NextShowTime(props: NextShowTimeProps) {
  const { experience, time, hasLaterShows } = props;
  const { goTo } = use(NavContext);

  if (!hasLaterShows) {
    return <Time time={time} />;
  }

  return (
    <button
      onClick={() => goTo(<ExperienceInfo experience={experience} />)}
      className="underline"
    >
      <Time time={time} />
    </button>
  );
}

// Shows the price and next return time of an individual Lightning Lane.
function IndividualLL({ experience, land }: ExperienceRowProps) {
  const { individual } = experience;

  if (!individual) {
    return null;
  }

  return (
    <div
      className={`${land.theme.text} text-xs leading-tight font-semibold text-center uppercase`}
    >
      <div>
        <abbr title="Lightning Lane">LL</abbr>
        {`: ${individual.displayPrice}`}
      </div>
      {individual.nextAvailableTime && (
        <div>
          <Time time={individual.nextAvailableTime} />
        </div>
      )}
    </div>
  );
}

function SymbolsLegend() {
  const theme = use(ThemeContext);

  return (
    <>
      <Legend title="Symbols">
        <Symbol sym="–" def="No posted wait/show time" />
        <Symbol sym="❌" def="Temporarily down" />
        <Symbol sym="VQ" def="Virtual queue" />
      </Legend>
      <p className="text-sm text-center">
        <span className={`${theme.text} font-bold`}>Popular attractions</span>{' '}
        are shown in bold
      </p>
    </>
  );
}

type ExperienceInfoProps = {
  experience: Experience;
};

function ExperienceInfo({ experience }: ExperienceInfoProps) {
  const showKind = experience.type === 'C' ? 'Appearances' : 'Shows';

  return (
    <Screen title="Experience Info">
      <h2>{experience.name}</h2>
      <LandLine land={experience.land} />
      <h3>Upcoming {showKind}</h3>
      <ul className="list-disc mt-2 pl-6">
        {experience.showTimes?.map(time => (
          <li key={+time}>
            <Time time={time} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}
