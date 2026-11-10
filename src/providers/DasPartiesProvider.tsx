import { ReactNode, use, useEffect, useState } from 'react';

import { RequestError } from '@/api/client';
import { DasParty } from '@/api/das';
import ClientsContext from '@/contexts/ClientsContext';
import DasPartiesContext from '@/contexts/DasPartiesContext';

type DasPartiesProviderProps = {
  children: ReactNode;
};

export default function DasPartiesProvider({
  children,
}: DasPartiesProviderProps) {
  const { das } = use(ClientsContext);
  const [parties, setParties] = useState<DasParty[]>([]);

  useEffect(() => {
    // DAS is optional: when the parties can't be requested, the app carries
    // on without them.
    async function loadParties() {
      try {
        setParties(await das.parties());
      } catch (error) {
        if (!(error instanceof RequestError)) {
          console.error(error);
        }
      }
    }

    void loadParties();
  }, [das]);

  return <DasPartiesContext value={parties}>{children}</DasPartiesContext>;
}
