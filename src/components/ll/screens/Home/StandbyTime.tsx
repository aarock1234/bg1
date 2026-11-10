import { Experience } from '@/api/ll';
import { Time } from '@/components/Time';

import LabeledItem from './LabeledItem';

// Average waits are shown rounded to the nearest multiple of this.
const AVERAGE_WAIT_STEP_MINUTES = 5;

const STATUS_CLASS =
  'inline-block border-2 rounded-sm px-1.5 py-0.5 font-semibold';

function roundToAverageWaitStep(minutes: number): number {
  return (
    Math.round(minutes / AVERAGE_WAIT_STEP_MINUTES) * AVERAGE_WAIT_STEP_MINUTES
  );
}

type StandbyTimeProps = {
  experience: Pick<
    Experience,
    'standby' | 'showTimes' | 'virtualQueue' | 'avgWait'
  >;
  average?: boolean;
};

export default function StandbyTime({ experience, average }: StandbyTimeProps) {
  const { standby, showTimes, virtualQueue, avgWait } = experience;

  if (average) {
    return <AverageWait time={avgWait} virtualQueue={virtualQueue} />;
  }

  if (showTimes) {
    return <NextShowTime showTimes={showTimes} />;
  }

  if (virtualQueue) {
    return <VQStatus virtualQueue={virtualQueue} />;
  }

  return <WaitTime standby={standby} />;
}

type MinutesProps = {
  children: number;
  rounded?: boolean;
};

function Minutes({ children, rounded }: MinutesProps) {
  const minutes = rounded ? roundToAverageWaitStep(children) : children;

  return (
    <time dateTime={`PT${minutes}M`}>
      {minutes} <span className="text-sm">min</span>
    </time>
  );
}

type AverageWaitProps = {
  time?: number;
  virtualQueue?: Experience['virtualQueue'];
};

function AverageWait(props: AverageWaitProps) {
  return (
    <LabeledItem label="Standby">
      <Available time={<AverageWaitValue {...props} />} />
    </LabeledItem>
  );
}

function AverageWaitValue({ time, virtualQueue }: AverageWaitProps) {
  if (time !== undefined) {
    return <Minutes rounded>{time}</Minutes>;
  }

  if (virtualQueue) {
    return <abbr title="Virtual queue">VQ</abbr>;
  }

  return (
    <abbr title="Not applicable" className="px-1">
      –
    </abbr>
  );
}

type WaitTimeProps = Pick<Experience, 'standby'>;

function WaitTime({ standby }: WaitTimeProps) {
  return (
    <LabeledItem label="Standby">
      <StandbyStatus standby={standby} />
    </LabeledItem>
  );
}

function StandbyStatus({ standby }: WaitTimeProps) {
  if (!standby.available) {
    return <Unavailable text="down" />;
  }

  if (standby.waitTime === undefined) {
    return <Available time="now" />;
  }

  return <Available time={<Minutes>{standby.waitTime}</Minutes>} />;
}

type NextShowTimeProps = Required<Pick<Experience, 'showTimes'>>;

function NextShowTime({ showTimes }: NextShowTimeProps) {
  const [nextShowTime] = showTimes;

  return (
    <LabeledItem
      label={
        <>
          Next <span className="hidden xs:inline">Show</span>
        </>
      }
    >
      {nextShowTime ? (
        <Available time={<Time time={nextShowTime} />} />
      ) : (
        <Unavailable text="none" />
      )}
    </LabeledItem>
  );
}

type VQStatusProps = Required<Pick<Experience, 'virtualQueue'>>;

function VQStatus({ virtualQueue }: VQStatusProps) {
  const { nextAvailableTime } = virtualQueue;

  return (
    <LabeledItem label={<abbr title="Virtual Queue">VQ</abbr>}>
      <Available
        time={nextAvailableTime ? <Time time={nextAvailableTime} /> : 'closed'}
      />
    </LabeledItem>
  );
}

type AvailableProps = {
  time: React.ReactNode;
};

export function Available({ time }: AvailableProps) {
  return (
    <span
      className={`${STATUS_CLASS} border-gray-500 text-gray-500 bg-gray-50`}
    >
      {time}
    </span>
  );
}

type UnavailableProps = {
  text: React.ReactNode;
};

export function Unavailable({ text }: UnavailableProps) {
  return (
    <span className={`${STATUS_CLASS} border-red-d text-red-d bg-red-100`}>
      {text}
    </span>
  );
}
