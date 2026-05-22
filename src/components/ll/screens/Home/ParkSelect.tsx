import { use, useMemo } from 'react';

import Select from '@/components/Select';
import ClientsContext from '@/contexts/ClientsContext';
import ParkContext from '@/contexts/ParkContext';
import RebookingContext from '@/contexts/RebookingContext';
import ResortContext from '@/contexts/ResortContext';

export default function ParkSelect(props: { className?: string }) {
  const { parks } = use(ResortContext);
  const { ll } = use(ClientsContext);
  const { park, setPark } = use(ParkContext);
  const rebooking = use(RebookingContext);

  const parkOptions = useMemo(
    () =>
      new Map(
        parks.map(park => [
          park.id,
          {
            value: park,
            icon: park.icon,
            text: park.name,
          },
        ])
      ),
    [parks]
  );

  return (
    <Select
      {...props}
      options={parkOptions}
      selected={park.id}
      onChange={setPark}
      disabled={!!rebooking.current && !ll.rules.parkModify}
      title="Park"
    />
  );
}
