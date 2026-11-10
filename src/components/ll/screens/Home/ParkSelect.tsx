import { use, useMemo } from 'react';

import Select from '@/components/Select';
import ClientsContext from '@/contexts/ClientsContext';
import ParkContext from '@/contexts/ParkContext';
import RebookingContext from '@/contexts/RebookingContext';
import ResortContext from '@/contexts/ResortContext';

type ParkSelectProps = {
  className?: string;
};

export default function ParkSelect(props: ParkSelectProps) {
  const { parks } = use(ResortContext);
  const { ll } = use(ClientsContext);
  const { park, setPark } = use(ParkContext);
  const rebooking = use(RebookingContext);

  const parkOptions = useMemo(() => {
    return new Map(
      parks.map(park => [
        park.id,
        {
          value: park,
          icon: park.icon,
          text: park.name,
        },
      ])
    );
  }, [parks]);

  const isRebooking = !!rebooking.current;
  const isParkLocked = isRebooking && !ll.rules.parkModify;

  return (
    <Select
      {...props}
      options={parkOptions}
      selected={park.id}
      onChange={setPark}
      disabled={isParkLocked}
      title="Park"
    />
  );
}
