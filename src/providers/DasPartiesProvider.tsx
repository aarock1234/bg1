import { use, useEffect, useState } from 'react';

import { RequestError } from '@/api/client';
import { DasParty } from '@/api/das';
import ClientsContext from '@/contexts/ClientsContext';
import DasPartiesContext from '@/contexts/DasPartiesContext';

export default function DasPartiesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { das } = use(ClientsContext);
  const [parties, setParties] = useState<DasParty[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setParties(await das.parties());
      } catch (error) {
        if (error instanceof RequestError) return;
        throw error;
      }
    })();
  }, [das]);

  return <DasPartiesContext value={parties}>{children}</DasPartiesContext>;
}
