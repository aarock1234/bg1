import { useState } from 'react';

import { ParkHours } from '@/api/ll';
import { ReturnTimeRange } from '@/api/ll/auto-book';
import { returnTimeSlots } from '@/api/ll/return-time-slots';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { DateTime, ParkTime, formatTime } from '@/datetime';
import { AutoBookStatus } from '@/hooks/useAutoBook';

import { attemptMessage, failureMessage } from './auto-book-messages';

const STOP_BUTTON_COLOR = 'bg-red-600 text-white';

type AutoBookProps = {
  status: AutoBookStatus;

  // The park's hours on the day being booked, once an offer has reported them.
  parkHours?: ParkHours;

  // Whether the booking is for today, when return times already past can't be
  // chosen.
  isForToday: boolean;

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
  status: AutoBookStatus;
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

  return (
    <label className="flex items-center gap-x-2 font-semibold">
      {label}
      <Select
        options={options}
        selected={selected.toString()}
        onChange={time => onChange(ParkTime.from(time))}
        title={`${label} Return Time`}
        disabled={disabled}
      />
    </label>
  );
}

function Progress({ status }: ProgressProps) {
  if (status.kind === 'failed') {
    return (
      <Alert title="Auto Booking Stopped">
        <p>{failureMessage(status.error)}</p>
      </Alert>
    );
  }

  if (status.kind !== 'searching') {
    return null;
  }

  const { attempts, lastAttempt } = status;

  return (
    <div role="status">
      <p>Looking for a return time…</p>
      {lastAttempt && (
        <p>
          {attemptMessage(lastAttempt)} Checked {attempts}{' '}
          {attempts === 1 ? 'time' : 'times'} so far.
        </p>
      )}
    </div>
  );
}

// Lets the guest pick a range of return times and have BG1 keep checking
// until it can book one of them.
export default function AutoBook(props: AutoBookProps) {
  const { status, parkHours, isForToday, onStart, onStop } = props;
  const [chosenEarliest, setChosenEarliest] = useState<ParkTime>();
  const [chosenLatest, setChosenLatest] = useState<ParkTime>();
  const isSearching = status.kind === 'searching';

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
    } else {
      onStart(range);
    }
  }

  return (
    <section className="mt-6">
      <h3>Auto Booking</h3>
      <p>
        BG1 can keep checking and book the first return time that falls within
        your range. Keep this screen open while it looks.
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
        <TimeSelect
          label="Earliest"
          times={slots}
          selected={earliest}
          disabled={isSearching}
          onChange={setChosenEarliest}
        />
        <TimeSelect
          label="Latest"
          times={latestSlots}
          selected={latest}
          disabled={isSearching}
          onChange={setChosenLatest}
        />
      </div>
      <Progress status={status} />
      <Button
        type="full"
        className="mt-4"
        color={isSearching ? STOP_BUTTON_COLOR : undefined}
        onClick={toggleSearch}
      >
        {isSearching ? 'Stop Auto Booking' : 'Start Auto Booking'}
      </Button>
    </section>
  );
}
