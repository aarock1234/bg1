import { useState } from 'react';

import Clock from './Clock';

const UNKNOWN_TIME = '--:--:--';

type TimeBoardProps = {
  label: string;
  time?: string | null;
};

export default function TimeBoard({ time, label }: TimeBoardProps) {
  const [isSynced, setIsSynced] = useState(true);

  return (
    <table className="mt-4 mx-auto text-gray-500">
      <tbody>
        <Row heading={label} time={<time>{time ?? UNKNOWN_TIME}</time>} />
        <Row
          heading="Current time"
          time={
            <>
              <Clock onSync={setIsSynced} />
              {!isSynced && (
                <span className="text-sm font-sans font-semibold text-red">
                  {' '}
                  (unsynced)
                </span>
              )}
            </>
          }
        />
      </tbody>
    </table>
  );
}

type RowProps = {
  heading: React.ReactNode;
  time: React.ReactNode;
};

function Row({ heading, time }: RowProps) {
  return (
    <tr>
      <th
        scope="row"
        className="pr-3 text-right text-xs font-semibold uppercase"
      >
        {heading}:
      </th>
      <td className="text-xl font-mono leading-tight">&#xfeff;{time}</td>
    </tr>
  );
}
