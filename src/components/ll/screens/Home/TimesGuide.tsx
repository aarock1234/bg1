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
          <RefreshButton name="Times" onClick={() => refreshExperiences()} />
        </>
      }
      subhead={
        <div className="flex">
          <ParkSelect className="min-w-0 flex-1 shrink" />
        </div>
      }
      ref={ref}
    >
      <Experiences experiences={experiences} isLoading={!!loaderElem} />
      {loaderElem}
    </Tab>
  );
}

type ExperiencesProps = {
  experiences: Experience[];
  isLoading: boolean;
};

const Experiences = memo(function Experiences({
  experiences,
  isLoading,
}: ExperiencesProps) {
  const experiencesByLand = groupByLand(experiences);

  if (experiences.length === 0) {
    return isLoading ? null : <NoTimes />;
  }

  return (
    <>
      {[...experiencesByLand].map(([land, experiencesByType]) => (
        <LandTimes
          land={land}
          experiencesByType={experiencesByType}
          key={land.name}
        />
      ))}

      <SymbolsLegend />
    </>
  );
});

// Shown once loading has finished without any times to list, which would
// otherwise leave the screen blank.
function NoTimes() {
  return (
    <p className="empty-state">
      No times to show right now. Check the park, or tap refresh to try again.
    </p>
  );
}

type LandTimesProps = {
  land: Land;
  experiencesByType: ExperiencesByType;
};

function LandTimes({ land, experiencesByType }: LandTimesProps) {
  return (
    <section>
      <h2 className="mt-7 px-1 text-[17px]">{land.name}</h2>
      {EXPERIENCE_SECTIONS.map(({ type, title }) => (
        <ExperienceList
          title={title}
          land={land}
          experiences={experiencesByType[type]}
          key={type}
        />
      ))}
    </section>
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
    <div className="list mt-2.5" data-testid={`${land.name}-${title}`}>
      <h3 className="mt-0 px-3.5 py-2 text-[13px] font-medium tracking-normal text-muted">
        {title}
      </h3>
      <table className="w-full leading-snug">
        <tbody>
          {experiences.map(experience => (
            <ExperienceRow experience={experience} key={experience.id} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ExperienceRowProps = {
  experience: Experience;
};

// A row of the guide: the posted time, then the experience's name. Popular
// attractions stand out by weight.
function ExperienceRow({ experience }: ExperienceRowProps) {
  return (
    <tr className="border-t border-line">
      <td className="w-22 py-3 pl-3.5 align-top font-semibold whitespace-nowrap tabular-nums">
        <PostedTime experience={experience} />
      </td>
      <td className="py-3 pr-3.5 pl-2 align-top">
        <div className="flex items-start gap-x-3">
          <div
            className={`flex-1 ${experience.highlight ? 'font-semibold' : ''}`}
          >
            {experience.name}
          </div>
          <IndividualLL experience={experience} />
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
    return <WaitTime minutes={standby.waitTime} />;
  }

  if (isVirtualQueueOnly) {
    return 'VQ';
  }

  return '❌';
}

type WaitTimeProps = {
  minutes: number | undefined;
};

// The unit is added by the stylesheet, which keeps the cell's text a plain
// number.
function WaitTime({ minutes }: WaitTimeProps) {
  if (minutes === undefined) {
    return '–';
  }

  return (
    <span className="after:ml-1 after:text-[13px] after:font-normal after:text-muted after:content-['min']">
      {minutes}
    </span>
  );
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
      className="font-semibold underline decoration-muted active:opacity-60"
    >
      <Time time={time} />
    </button>
  );
}

// Shows the price and next return time of an individual Lightning Lane.
function IndividualLL({ experience }: ExperienceRowProps) {
  const { individual } = experience;

  if (!individual) {
    return null;
  }

  return (
    <div className="text-right text-[13px] leading-tight font-medium text-muted">
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
  return (
    <>
      <Legend title="Symbols">
        <Symbol sym="–" def="No posted wait/show time" />
        <Symbol sym="❌" def="Temporarily down" />
        <Symbol sym="VQ" def="Virtual queue" />
      </Legend>
      <p className="note text-center">
        <span className="font-semibold text-ink">Popular attractions</span> are
        shown in bold
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
      <h3 className="section-title">Upcoming {showKind}</h3>
      <ul className="list">
        {experience.showTimes?.map(time => (
          <li className="row font-medium" key={+time}>
            <Time time={time} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}
