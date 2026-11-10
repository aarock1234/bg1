import { DateFormatType, formatDate } from '@/datetime';

type DayProps = React.HTMLProps<HTMLTimeElement> & {
  children: string;
  type?: DateFormatType;
};

// Shows a YYYY-MM-DD date in a readable form. Anything that isn't a valid date
// is shown as it is.
export function Day({ children: date, type, ...attrs }: DayProps) {
  let formattedDate: string;

  try {
    formattedDate = formatDate(date, type);
  } catch (error) {
    console.error(error);

    return date;
  }

  return (
    <time {...attrs} dateTime={date}>
      {formattedDate}
    </time>
  );
}
