import ReturnWindow from './ReturnWindow';

type ReturnTimeProps = Parameters<typeof ReturnWindow>[0] & {
  button?: React.ReactNode;
};

// Shows a return window under a quiet caption, with an optional action at the
// right. It has no surface of its own, so it can sit inside a card.
export default function ReturnTime({ start, end, button }: ReturnTimeProps) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <div className="min-w-0 text-[13px] leading-snug text-muted">
        {end ? 'Arrive by' : 'Reservation at'}:{' '}
        <span className="mt-0.5 block text-[17px] font-semibold text-ink">
          <ReturnWindow start={start} end={end} />
        </span>
      </div>
      {button}
    </div>
  );
}

// A return time on a card of its own, for a screen that shows it on the page.
export function ReturnTimeCard(props: ReturnTimeProps) {
  return (
    <div className="card mt-4 py-3 *:mt-0">
      <ReturnTime {...props} />
    </div>
  );
}
