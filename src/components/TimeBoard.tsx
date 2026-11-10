import { useState } from 'react';

import Clock from './Clock';

const UNKNOWN_TIME = '--:--:--';

type TimeBoardProps = {
  label: string;
  time?: string | null;
};

// Shows a target time above a running clock, so the two can be compared at a
// glance.
export default function TimeBoard({ time, label }: TimeBoardProps) {
  const [isSynced, setIsSynced] = useState(true);

  return (
    <div className="list mt-4">
      <table className="w-full">
        <tbody>
          <Row heading={label} time={<time>{time ?? UNKNOWN_TIME}</time>} />
          <Row
            heading="Current time"
            time={
              <>
                <Clock onSync={setIsSynced} />
                {!isSynced && (
                  <span className="font-sans text-sm font-medium text-danger">
                    {' '}
                    (unsynced)
                  </span>
                )}
              </>
            }
          />
        </tbody>
      </table>
    </div>
  );
}

type RowProps = {
  heading: React.ReactNode;
  time: React.ReactNode;
};

function Row({ heading, time }: RowProps) {
  return (
    <tr className="border-line not-first:border-t">
      <th
        scope="row"
        className="py-3 pr-3 pl-3.5 text-left text-sm font-medium text-muted"
      >
        {heading}:
      </th>
      <td className="py-3 pr-3.5 text-right font-mono text-xl leading-tight tabular-nums">
        &#xfeff;{time}
      </td>
    </tr>
  );
}
