import { useState } from 'react';

import { JobView } from '@/api/bg1-server';
import { ParkHours } from '@/api/ll';
import { ReturnTimeRange } from '@/api/ll/auto-book';
import { returnTimeSlots } from '@/api/ll/return-time-slots';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { DateTime, ParkTime, formatTime } from '@/datetime';
import { ServerJobState } from '@/hooks/useServerJob';
import { canNotify } from '@/push';

import OpenDisneyApp from './OpenDisneyApp';
import {
  attemptMessage,
  bookedMessage,
  rejectionMessage,
} from './auto-book-messages';

type AutoBookProps = {
  state: ServerJobState;

  // The park's hours on the day being booked, once an offer has reported them.
  parkHours?: ParkHours;

  // Whether the booking is for today, when return times already past can't be
  // chosen.
  isForToday: boolean;

  // Why the latest request to stop the search failed, or undefined when it
  // didn't.
  stopError: unknown;

  onStart: (range: ReturnTimeRange) => void;
  onStop: () => void;
};

type TimeSelectProps = {
  label: string;
  times: ParkTime[];
  selected: ParkTime;
  disabled: boolean;
  onChange: (time: ParkTime) => void;
};

type TimeOption = {
  text: string;
};

type ProgressProps = {
  children: React.ReactNode;
};

type SearchingProps = {
  job: JobView;
};

type OutcomeProps = {
  state: ServerJobState;
};

type StopFailureProps = {
  error: unknown;
};

function findSlot(
  slots: ParkTime[],
  time: ParkTime | undefined
): ParkTime | undefined {
  if (!time) {
    return undefined;
  }

  return slots.find(slot => slot.equals(time));
}

function TimeSelect(props: TimeSelectProps) {
  const { label, times, selected, disabled, onChange } = props;
  const options = new Map<string, TimeOption>();

  for (const time of times) {
    options.set(time.toString(), {
      text: formatTime(time),
    });
  }

  // A label would forward the tap that closes the menu to the button, which
  // would open it again.
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <Select
        options={options}
        selected={selected.toString()}
        onChange={time => onChange(ParkTime.from(time))}
        title={`${label} Return Time`}
        disabled={disabled}
        className="w-full tabular-nums"
      />
    </div>
  );
}

function Progress({ children }: ProgressProps) {
  return (
    <div
      role="status"
      className="mt-4 flex gap-3 rounded-control border border-line-strong bg-pressed p-3"
    >
      <div className="spinner mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Shown while a search handed over earlier hasn't been heard about yet.
function Resuming() {
  return (
    <Progress>
      <p className="my-0 text-[15px] font-medium">Checking on your watch…</p>
    </Progress>
  );
}

function Searching({ job }: SearchingProps) {
  const { attempts, lastAttempt } = job;

  return (
    <Progress>
      <p className="my-0 text-[15px] font-medium">
        Watching for a return time…
      </p>
      <p className="note mt-1 mb-0">
        {lastAttempt && `${attemptMessage(lastAttempt)} `}
        Checked {attempts} {attempts === 1 ? 'time' : 'times'} so far. You can
        close BG1; it keeps watching.
      </p>
    </Progress>
  );
}

// Shown while the search carries on because the server couldn't be told to
// stop it.
function StopFailure({ error }: StopFailureProps) {
  return (
    <Alert title="Couldn't Stop Watching" className="bg-pressed">
      <p>{rejectionMessage(error)}</p>
    </Alert>
  );
}

// Shows how a search ended, or why it couldn't be started.
function Outcome({ state }: OutcomeProps) {
  if (state.kind === 'rejected') {
    return (
      <Alert title="Watching Didn't Start" className="bg-pressed">
        <p>{rejectionMessage(state.error)}</p>
      </Alert>
    );
  }

  if (state.kind !== 'tracking') {
    return null;
  }

  const { status, result, failure, resortId } = state.job;

  if (status === 'available' && result) {
    return (
      <Alert title="Lightning Lane Available" className="bg-pressed">
        <p>
          {bookedMessage(result)} is available. Book it in the Disney app now,
          before it's gone.
        </p>
        <OpenDisneyApp resortId={resortId} isPrimary />
      </Alert>
    );
  }

  if (status === 'booked' && result) {
    return (
      <Alert title="Lightning Lane Booked" className="bg-pressed">
        <p>{bookedMessage(result)}. It is in your plans.</p>
      </Alert>
    );
  }

  if (failure) {
    return (
      <Alert title="Watching Stopped" className="bg-pressed">
        <p>{failure.message}</p>
      </Alert>
    );
  }

  return null;
}

// Lets the guest pick a range of return times and have BG1's server keep
// checking until it can book one of them, even after the app is closed.
export default function AutoBook(props: AutoBookProps) {
  const { state, parkHours, isForToday, stopError, onStart, onStop } = props;
  const [chosenEarliest, setChosenEarliest] = useState<ParkTime>();
  const [chosenLatest, setChosenLatest] = useState<ParkTime>();
  const trackedJob = state.kind === 'tracking' ? state.job : undefined;
  const isSearching = trackedJob?.status === 'searching';

  // Whether the server is being asked to take a search, or how one is going.
  const isWaiting = state.kind === 'starting' || state.kind === 'resuming';
  const isBusy = isSearching || isWaiting;

  const slots = returnTimeSlots({
    parkHours,
    notBefore: isForToday ? DateTime.now().time : undefined,
  });
  const earliest = findSlot(slots, chosenEarliest) ?? slots[0];

  if (!earliest) {
    return null;
  }

  // A choice that is no longer possible falls back to the widest range: from
  // the first slot until the park closes.
  const latestSlots = slots.filter(slot => slot >= earliest);
  const latest = findSlot(latestSlots, chosenLatest) ?? latestSlots.at(-1);

  if (!latest) {
    return null;
  }

  const range: ReturnTimeRange = {
    earliest,
    latest,
  };

  function toggleSearch(): void {
    if (isSearching) {
      onStop();
      return;
    }

    onStart(range);
  }

  return (
    <section className="card mt-6">
      <h3 className="mt-0">Watch for a Return Time</h3>
      <p className="note mt-1">
        BG1 keeps checking, even with your phone closed, and tells you when the
        next return time falls within your range. Then book it in the Disney
        app.
        {canNotify() && ' You get a notification when it does.'}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TimeSelect
          label="Earliest"
          times={slots}
          selected={earliest}
          disabled={isBusy}
          onChange={setChosenEarliest}
        />
        <TimeSelect
          label="Latest"
          times={latestSlots}
          selected={latest}
          disabled={isBusy}
          onChange={setChosenLatest}
        />
      </div>
      {state.kind === 'resuming' && <Resuming />}
      {trackedJob && isSearching && <Searching job={trackedJob} />}
      {stopError !== undefined && <StopFailure error={stopError} />}
      <Outcome state={state} />
      <Button
        type="full"
        className="mt-4"
        variant={isSearching ? 'danger' : 'secondary'}
        disabled={isWaiting}
        onClick={toggleSearch}
      >
        {isSearching ? 'Stop Watching' : 'Start Watching'}
      </Button>
    </section>
  );
}
