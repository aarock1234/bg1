import { use, useMemo } from 'react';

import MenuButton, { MenuProps, Option } from '@/components/MenuButton';
import BookingDateContext from '@/contexts/BookingDateContext';
import ThemeContext from '@/contexts/ThemeContext';
import { DateFormat, modifyDate, parkDate, toDate } from '@/datetime';
import useUpdateParkFromPlans from '@/hooks/useUpdateParkFromPlans';
import { NUM_BOOKING_DAYS } from '@/providers/BookingDateProvider';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_PER_WEEK = WEEKDAY_NAMES.length;

const MONTH_FORMAT = new DateFormat({
  month: 'long',
});

type DateOptions = Map<string, Option<string>>;

// Returns an option for each bookable date, keyed by its YYYY-MM-DD date. The
// button shows the month and day, while the calendar only needs the day.
function bookingDateOptions(today: string): DateOptions {
  const options: DateOptions = new Map();

  for (let dayOffset = 0; dayOffset < NUM_BOOKING_DAYS; dayOffset++) {
    const date = modifyDate(today, dayOffset);
    const [month, day] = date.split('-').slice(1).map(Number);

    options.set(date, {
      buttonText: date === today ? 'Today' : `${month}/${day}`,
      text: `${day}`,
    });
  }

  return options;
}

// Returns the Sunday that starts each calendar week needed to show `dayCount`
// days beginning on `firstDate`.
function weekStartDates(firstDate: string, dayCount: number): string[] {
  const firstDay = toDate(firstDate);
  const calendarStart = modifyDate(firstDay, -firstDay.getDay());
  const weekCount = Math.ceil(dayCount / DAYS_PER_WEEK);
  const weekStarts: string[] = [];

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
    weekStarts.push(modifyDate(calendarStart, weekIndex * DAYS_PER_WEEK));
  }

  return weekStarts;
}

function monthRange(firstDate: string, lastDate: string): string {
  const firstMonth = MONTH_FORMAT.format(firstDate);
  const lastMonth = MONTH_FORMAT.format(lastDate);

  if (firstMonth === lastMonth) {
    return firstMonth;
  }

  return `${firstMonth} – ${lastMonth}`;
}

type BookingDateSelectProps = {
  className?: string;
};

export default function BookingDateSelect(props: BookingDateSelectProps) {
  const { bookingDate, setBookingDate } = use(BookingDateContext);
  const updateParkFromPlans = useUpdateParkFromPlans();
  const today = parkDate();
  const options = useMemo(() => bookingDateOptions(today), [today]);

  function changeBookingDate(date: string) {
    if (date === bookingDate) {
      return;
    }

    setBookingDate(date);
    updateParkFromPlans(date);
  }

  return (
    <MenuButton
      {...props}
      title="Booking Date"
      options={options}
      selected={bookingDate}
      onChange={changeBookingDate}
      menuType={CalendarMenu}
    />
  );
}

function CalendarMenu<K extends string, V>(props: MenuProps<K, V>) {
  const { options, selected } = props;
  const optionsByDate = new Map<string, Option<V>>(options);
  const dates = [...optionsByDate.keys()];
  const firstDate = dates[0];
  const lastDate = dates.at(-1);

  if (firstDate === undefined || lastDate === undefined) {
    return null;
  }

  return (
    <div className="px-1 pb-1">
      <h4 className="mt-3 text-lg text-center">
        {monthRange(firstDate, lastDate)}
      </h4>
      <table className="table-fixed border-separate border-spacing-0.5 w-full mt-2 font-semibold">
        <thead>
          <tr>
            {WEEKDAY_NAMES.map(weekday => (
              <th
                className="text-xs font-semibold uppercase text-center text-gray-500"
                key={weekday}
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekStartDates(firstDate, dates.length).map(weekStart => (
            <CalendarWeek
              weekStart={weekStart}
              optionsByDate={optionsByDate}
              selected={selected}
              key={weekStart}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type CalendarWeekProps<V> = {
  weekStart: string;
  optionsByDate: Map<string, Option<V>>;
  selected?: string;
};

function CalendarWeek<V>(props: CalendarWeekProps<V>) {
  const { weekStart, optionsByDate, selected } = props;
  const weekDates = WEEKDAY_NAMES.map((_weekday, dayOffset) =>
    modifyDate(weekStart, dayOffset)
  );

  return (
    <tr>
      {weekDates.map(date => (
        <CalendarDay
          date={date}
          option={optionsByDate.get(date)}
          isSelected={date === selected}
          key={date}
        />
      ))}
    </tr>
  );
}

type CalendarDayProps<V> = {
  date: string;
  option?: Option<V>;
  isSelected: boolean;
};

// Days outside the booking window have no option and are left blank.
function CalendarDay<V>({ date, option, isSelected }: CalendarDayProps<V>) {
  const { bg } = use(ThemeContext);

  if (!option) {
    return <td />;
  }

  return (
    <td className="p-0">
      <label className={`block p-2 ${bg} text-white`}>
        <span className="flex items-center justify-center border-y-4 border-transparent has-checked:border-white py-0.5">
          <input
            type="radio"
            name="bookingDate"
            value={date}
            defaultChecked={isSelected}
            className="sr-only"
          />
          <time dateTime={date}>{option.text}</time>
        </span>
      </label>
    </td>
  );
}
