import { use, useCallback, useLayoutEffect, useState } from 'react';

import { HourlyTimes, Offer, OfferItineraryItem } from '@/api/ll';
import { Overlap } from '@/api/ll/wdw';
import Button from '@/components/Button';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';
import { Time } from '@/components/Time';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';
import RebookingContext from '@/contexts/RebookingContext';
import { DateTime, ParkTime, parkDate } from '@/datetime';
import useDataLoader from '@/hooks/useDataLoader';
import kvdb from '@/kvdb';

import BookingDate from '../BookingDate';
import RebookingHeader from '../RebookingHeader';
import { ReturnTimeCard } from '../ReturnTime';
import YourDayButton from '../YourDayButton';
import Home from './Home';
import Legend from './Home/Legend';
import RefreshButton from './RefreshButton';

export const FULL_AVAILABILITY_KEY = 'bg1.ll.fullAvailability';

// With full availability, return times are offered in 10-minute slots.
const SLOT_MINUTES = 10;
const HOUR_SLOT_MINUTES = [0, 10, 20, 30, 40, 50];

// A reported time this close to the offer's own time, in minutes, makes the
// offer's time redundant in the list of reported times.
const SAME_TIME_TOLERANCE_MINUTES = 5;

// An hour that reports more times than this is assumed to be available
// throughout.
const MAX_TIMES_IN_PARTIAL_HOUR = 2;

// How long before park close the last return time can start.
const LAST_RETURN_MINUTES_BEFORE_CLOSE = 30;

// A = Available, U = Unavailable, O = Overlaps another plan
type AvailabilityCode = 'A' | 'U' | 'O';

const AVAILABILITY_NAMES: Record<AvailabilityCode, string> = {
  A: 'Available',
  U: 'Unavailable',
  O: 'Overlap',
};

type AvailabilityByTime = Map<ParkTime, AvailabilityCode>;

type HourAvailability = {
  hour: number;
  times: AvailabilityByTime;
};

type TimeOverlap = OfferItineraryItem['overlap'];

type FullAvailabilityOffer = Offer & Required<Pick<Offer, 'parkHours'>>;

type SelectTime = (time: ParkTime) => Promise<void>;

// Full availability is a guess that needs the park's hours, and it isn't
// offered for shows because they only have their actual show times.
function allowsFullAvailability(offer: Offer): offer is FullAvailabilityOffer {
  return offer.experience.type !== 'E' && !!offer.parkHours;
}

function floorToSlot(time: ParkTime): ParkTime {
  return time.add({
    minutes: -(time.minute % SLOT_MINUTES),
  });
}

function compareTimes(a: ParkTime, b: ParkTime): number {
  return +a - +b;
}

// Treats exactly the reported times as available.
function reportedAvailability(times: HourlyTimes): HourAvailability[] {
  return times.flatMap(hourTimes => {
    const [firstTime] = hourTimes;

    if (!firstTime) {
      return [];
    }

    return {
      hour: firstTime.hour,
      times: new Map(hourTimes.map(time => [time, 'A'])),
    };
  });
}

// Groups the reported times by hour, adding the offer's own time unless a
// reported time is already close to it.
function groupTimesByHour(
  times: HourlyTimes,
  offerTime: ParkTime
): Map<number, ParkTime[]> {
  const timesByHour = new Map<number, ParkTime[]>();

  for (const hourTimes of times) {
    const [firstTime] = hourTimes;

    if (firstTime) {
      timesByHour.set(firstTime.hour, [...hourTimes]);
    }
  }

  const offerHourTimes = timesByHour.get(offerTime.hour) ?? [];
  const isOfferTimeReported = offerHourTimes.some(time => {
    const minutesApart = Math.abs(time.minute - offerTime.minute);

    return minutesApart <= SAME_TIME_TOLERANCE_MINUTES;
  });

  if (!isOfferTimeReported) {
    const timesWithOffer = [...offerHourTimes, offerTime].sort(compareTimes);

    timesByHour.set(offerTime.hour, timesWithOffer);
  }

  return timesByHour;
}

// Returns the 10-minute slots of an hour that its reported times stand for.
// A time whose own slot overlaps a plan stands for the next slot instead, if
// that slot is still within the hour.
function reportedSlotMinutes(
  hour: number,
  reportedTimes: ParkTime[],
  canReturnAt: (time: ParkTime) => boolean
): Set<number> {
  const minutes = reportedTimes.flatMap(time => {
    const slot = floorToSlot(time);

    if (canReturnAt(slot)) {
      return slot.minute;
    }

    const nextSlot = slot.add({
      minutes: SLOT_MINUTES,
    });

    return nextSlot.hour === hour ? nextSlot.minute : [];
  });

  return new Set(minutes);
}

function countCode(times: AvailabilityByTime, code: AvailabilityCode): number {
  return [...times.values()].filter(timeCode => timeCode === code).length;
}

function replaceCode(
  times: AvailabilityByTime,
  from: AvailabilityCode,
  to: AvailabilityCode
): void {
  for (const [time, code] of times) {
    if (code === from) {
      times.set(time, to);
    }
  }
}

type HourOptions = {
  hour: number;
  reportedTimes: ParkTime[];

  // Every slot that doesn't overlap a plan is assumed to be available.
  isFullHour: boolean;
  hasOverlaps: boolean;

  // Whether a return time wouldn't overlap another plan too much.
  canReturnAt: (time: ParkTime) => boolean;
};

function hourAvailability(options: HourOptions): AvailabilityByTime {
  const { hour, reportedTimes, isFullHour, hasOverlaps, canReturnAt } = options;
  const reportedMinutes = reportedSlotMinutes(hour, reportedTimes, canReturnAt);

  function slotCode(slot: ParkTime): AvailabilityCode {
    if (!canReturnAt(slot)) {
      return 'O';
    }

    return isFullHour || reportedMinutes.has(slot.minute) ? 'A' : 'U';
  }

  const times: AvailabilityByTime = new Map();

  for (const minute of HOUR_SLOT_MINUTES) {
    const slot = new ParkTime(hour, minute);

    times.set(slot, slotCode(slot));
  }

  // Overlaps hide some of the hour's reported times. If enough of what is
  // left is available, the rest of the hour most likely is too.
  const hasEnoughAvailable = countCode(times, 'A') * 2 >= countCode(times, 'U');

  if (!isFullHour && hasOverlaps && hasEnoughAvailable) {
    replaceCode(times, 'U', 'A');
  }

  return times;
}

// Nothing is available before the first time that is known to be. Slots that
// overlap a plan keep saying so.
function markUnavailableBefore(
  times: AvailabilityByTime,
  firstTime: ParkTime
): void {
  for (const [time, code] of times) {
    if (time >= firstTime) {
      break;
    }

    if (code === 'A') {
      times.set(time, 'U');
    }
  }
}

function markUnavailableAfter(
  times: AvailabilityByTime,
  lastTime: ParkTime
): void {
  for (const [time] of times) {
    if (time > lastTime) {
      times.set(time, 'U');
    }
  }
}

// Estimates the availability of every 10-minute slot from now (or park open)
// until park close. The Lightning Lane system reports only some of the
// available times, so the rest is an educated guess.
function fullAvailabilityTimes(
  offer: Offer,
  times: HourlyTimes
): HourAvailability[] {
  const firstReportedTime = times[0]?.[0];

  if (!firstReportedTime || !allowsFullAvailability(offer)) {
    return reportedAvailability(times);
  }

  const { booking } = offer;
  const offerTime = offer.start.time;
  const overlaps: TimeOverlap[] = offer.itinerary.map(item => item.overlap);

  // Overlapping the booking being modified is fine, since it gets replaced.
  const bookingOverlap = booking
    ? new Overlap({
        startTime: booking.start.time,
        endTime: booking.end.time,
      })
    : undefined;

  if (bookingOverlap) {
    overlaps.push(bookingOverlap);
  }

  const timesByHour = groupTimesByHour(times, offerTime);
  const firstReportedSlot = floorToSlot(firstReportedTime);
  const firstTime =
    offerTime < firstReportedSlot ? floorToSlot(offerTime) : firstReportedSlot;

  const { openTime, closeTime } = offer.parkHours;
  const isToday = parkDate(offer.start) === parkDate();
  const startTime = isToday ? DateTime.now().time : openTime;
  const firstHour = Math.max(startTime.hour, openTime.hour);
  const lastHour = closeTime.hour - 1;
  const lastTime = closeTime.add({
    minutes: -LAST_RETURN_MINUTES_BEFORE_CLOSE,
  });

  const hours: HourAvailability[] = [];
  let isFullHour = false;

  for (let hour = firstHour; hour <= lastHour; hour++) {
    const hourStart = new ParkTime(hour);
    const hourEnd = new ParkTime(hour, 59);
    const reportedTimes = timesByHour.get(hour) ?? [];
    const hourOverlaps = overlaps.filter(overlap => {
      return overlap.contains(hourStart) || overlap.contains(hourEnd);
    });
    const hasOverlaps = hourOverlaps.length > 0;
    const endsAtParkClose = hour === lastHour && closeTime.minute === 0;

    // The hour that ends at park close has fewer times to report. An hour
    // interrupted by an overlap stays full if the hour before it was.
    isFullHour =
      reportedTimes.length > MAX_TIMES_IN_PARTIAL_HOUR ||
      (endsAtParkClose && reportedTimes.length > 1) ||
      (isFullHour && hasOverlaps);

    const hourTimes = hourAvailability({
      hour,
      reportedTimes,
      isFullHour,
      hasOverlaps,
      canReturnAt: time => {
        return hourOverlaps.every(overlap => {
          return !overlap.contains(time) || overlap === bookingOverlap;
        });
      },
    });

    if (hour === firstTime.hour) {
      markUnavailableBefore(hourTimes, firstTime);
    } else if (hour === lastHour) {
      markUnavailableAfter(hourTimes, lastTime);
    }

    hours.push({
      hour,
      times: hourTimes,
    });
  }

  return hours;
}

type TimeButtonsRowProps = {
  hour: number;
  children: React.ReactNode;
};

function TimeButtonsRow({ hour, children }: TimeButtonsRowProps) {
  return (
    <>
      <h4 className="flex items-center justify-end bg-surface pl-3.5 text-sm font-medium whitespace-nowrap text-muted">
        <Time time={`${hour}`} />
      </h4>
      <div className="flex flex-wrap gap-1.5 bg-surface px-3 py-2">
        {children}
      </div>
    </>
  );
}

type MinuteButtonProps = {
  time: ParkTime;
  code: AvailabilityCode;
  onClick: SelectTime;
};

// Availability is told apart by shape as well as by brightness: an available
// time is a filled button, one that overlaps a plan has a dashed outline, and
// an unavailable one is bare.
const MINUTE_BUTTON_CLASSES: Record<AvailabilityCode, string> = {
  A: 'border-line-strong bg-pressed font-medium text-ink',
  O: 'border-dashed border-line-strong text-muted',
  U: 'border-transparent text-faint',
};

function MinuteButton({ time, code, onClick }: MinuteButtonProps) {
  const timeString = `${time}`;
  const minuteLabel = timeString.slice(2, 5);

  return (
    <button
      className={`h-10 min-w-0 flex-1 rounded-control border text-[15px] transition-colors active:bg-line ${MINUTE_BUTTON_CLASSES[code]}`}
      onClick={() => onClick(ParkTime.from(time))}
      aria-label={`${AVAILABILITY_NAMES[code]}: ${time}`}
    >
      <time dateTime={timeString}>{minuteLabel}</time>
    </button>
  );
}

type AvailabilityTypeProps = {
  code: AvailabilityCode;
};

// A legend entry: a sample button for an availability code, with its name.
function AvailabilityType({ code }: AvailabilityTypeProps) {
  return (
    <tr className="flex flex-1 flex-col items-center gap-1.5">
      <td className="flex w-12">
        <MinuteButton
          time={new ParkTime(0)}
          code={code}
          onClick={async () => undefined}
        />
      </td>
      <th className="text-[13px] text-muted">{AVAILABILITY_NAMES[code]}</th>
    </tr>
  );
}

type TimeButtonsProps = {
  offer: Offer;
  times: HourlyTimes;
  onClick: SelectTime;
};

function AvailableOnlyButtons({ times, onClick }: TimeButtonsProps) {
  return times.map(hourTimes => {
    const [firstTime] = hourTimes;

    if (!firstTime) {
      return null;
    }

    return (
      <TimeButtonsRow hour={firstTime.hour} key={firstTime.hour}>
        {hourTimes.map(time => (
          <Button onClick={() => onClick(time)} key={time.toString()}>
            <Time time={time} />
          </Button>
        ))}
      </TimeButtonsRow>
    );
  });
}

function FullAvailabilityButtons({ offer, times, onClick }: TimeButtonsProps) {
  const hours = fullAvailabilityTimes(offer, times);

  return hours.map(({ hour, times: hourTimes }) => (
    <TimeButtonsRow hour={hour} key={hour}>
      {[...hourTimes].map(([time, code]) => (
        <MinuteButton
          time={time}
          code={code}
          onClick={onClick}
          key={time.minute}
        />
      ))}
    </TimeButtonsRow>
  ));
}

type TimeSelectionProps = {
  offer: Offer;

  // Undefined until the times have loaded.
  times: HourlyTimes | undefined;
  showsFullAvailability: boolean;
  onFullAvailabilityToggle: () => void;
  onSelect: SelectTime;
};

function TimeSelection({
  offer,
  times,
  showsFullAvailability,
  onFullAvailabilityToggle,
  onSelect,
}: TimeSelectionProps) {
  if (!times) {
    return null;
  }

  if (times.length === 0) {
    return <p className="empty-state">No other times available</p>;
  }

  const TimeButtons = showsFullAvailability
    ? FullAvailabilityButtons
    : AvailableOnlyButtons;

  return (
    <>
      {allowsFullAvailability(offer) && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <h3 className="mt-0">Availabile Times</h3>
          <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
            <input
              type="checkbox"
              checked={showsFullAvailability}
              onChange={onFullAvailabilityToggle}
            />{' '}
            Show all
          </label>
        </div>
      )}

      <div className="list mt-3">
        <div
          className="grid grid-cols-[auto_1fr] gap-y-px bg-line"
          data-testid="time-buttons"
        >
          <TimeButtons offer={offer} times={times} onClick={onSelect} />
        </div>
      </div>

      {showsFullAvailability && (
        <Legend title="Return Time Availability" flex="py-1">
          <AvailabilityType code="A" />
          <AvailabilityType code="O" />
          <AvailabilityType code="U" />
        </Legend>
      )}

      <p className="note mt-6 px-1">
        The Lightning Lane system reports a limited subset of available return
        times. When &quot;show all&quot; is enabled, BG1 makes some educated
        guesses to give you more options. The closest available alternative will
        be offered if you select a return time that doesn't actually exist.
      </p>
    </>
  );
}

type SelectReturnTimeProps<B extends Offer['booking']> = {
  offer: Offer<B>;
  onOfferChange: (offer: Offer<B>) => void;
};

export default function SelectReturnTime<B extends Offer['booking']>({
  offer,
  onOfferChange,
}: SelectReturnTimeProps<B>) {
  const { goBack } = use(NavContext);
  const { ll } = use(ClientsContext);
  const rebooking = use(RebookingContext);
  const { loadData, loaderElem } = useDataLoader();
  const [times, setTimes] = useState<HourlyTimes>();
  const [showsFullAvailability, setShowsFullAvailability] = useState(() => {
    const isEnabled = kvdb.get(FULL_AVAILABILITY_KEY) === true;

    return allowsFullAvailability(offer) && isEnabled;
  });

  // When only a booking's time is being changed, its current return time is
  // the one to keep, rather than the offer's.
  const { booking } = offer;
  const currentReturnTime = booking && !rebooking.current ? booking : offer;

  const refreshTimes = useCallback(() => {
    loadData(async () => {
      setTimes(await ll.times(offer));
    });
  }, [offer, ll, loadData]);

  useLayoutEffect(() => {
    refreshTimes();
  }, [refreshTimes]);

  function toggleFullAvailability() {
    const newShowsFullAvailability = !showsFullAvailability;

    setShowsFullAvailability(newShowsFullAvailability);
    kvdb.set(FULL_AVAILABILITY_KEY, newShowsFullAvailability);
  }

  async function selectTime(time: ParkTime) {
    if (time.equals(offer.start.time)) {
      await goBack();
      onOfferChange({
        ...offer,
        changed: false,
      });

      return;
    }

    await loadData(async () => {
      const newOffer = await ll.changeOfferTime(offer, time);

      await goBack();
      onOfferChange(newOffer);
    });
  }

  return (
    <Screen
      title="Select Return Time"
      buttons={
        <>
          <YourDayButton date={parkDate(offer.start)} unmodifiable />
          <RefreshButton name="Times" onClick={refreshTimes} />
        </>
      }
      subhead={
        <>
          <RebookingHeader
            back={
              rebooking.auto
                ? {
                    screen: Home,
                  }
                : true
            }
          />
          <BookingDate booking={offer} />
        </>
      }
      theme={offer.experience.park.theme}
    >
      <h2 className="mt-5">{offer.experience.name}</h2>
      <LandLine land={offer.experience.land} />
      <ReturnTimeCard
        start={currentReturnTime.start}
        end={currentReturnTime.end}
        button={
          <Button type="small" onClick={goBack}>
            Keep
          </Button>
        }
      />
      <TimeSelection
        offer={offer}
        times={times}
        showsFullAvailability={showsFullAvailability}
        onFullAvailabilityToggle={toggleFullAvailability}
        onSelect={selectTime}
      />
      {loaderElem}
    </Screen>
  );
}
