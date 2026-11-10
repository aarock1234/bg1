import ReturnWindow from './ReturnWindow';

type ReturnTimeProps = Parameters<typeof ReturnWindow>[0] & {
  button?: React.ReactNode;
};

export default function ReturnTime({ start, end, button }: ReturnTimeProps) {
  return (
    <div className="mt-4 text-lg">
      <div className="flex items-center gap-x-3">
        <div>
          {end ? 'Arrive by' : 'Reservation at'}:{' '}
          <span className="pl-1 font-semibold">
            <ReturnWindow start={start} end={end} />
          </span>
        </div>
        <div>{button}</div>
      </div>
    </div>
  );
}
