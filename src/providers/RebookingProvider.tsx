import { ReactNode, useMemo, useState } from 'react';

import { LLMP } from '@/api/itinerary';
import RebookingContext, { Rebooking } from '@/contexts/RebookingContext';

type RebookingProviderProps = {
  children: ReactNode;
  // Replaces the provider's own rebooking state.
  value?: Rebooking;
};

export default function RebookingProvider({
  children,
  value,
}: RebookingProviderProps) {
  const [current, setCurrent] = useState<LLMP>();
  const [auto, setAuto] = useState(false);

  const rebooking = useMemo<Rebooking>(() => {
    return {
      current,
      auto,

      begin(booking, isAuto = false) {
        setCurrent(booking);
        setAuto(isAuto);
      },

      end() {
        setCurrent(undefined);
        setAuto(false);
      },
    };
  }, [current, auto]);

  return (
    <RebookingContext value={value ?? rebooking}>{children}</RebookingContext>
  );
}
