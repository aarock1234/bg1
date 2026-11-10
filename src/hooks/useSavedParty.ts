import { use, useCallback, useEffect, useState } from 'react';

import ClientsContext from '@/contexts/ClientsContext';
import kvdb from '@/kvdb';

export const PARTY_IDS_KEY = 'bg1.genie.partyIds';

type SavePartyIds = (partyIds: Set<string>) => void;

function loadPartyIds(): Set<string> {
  const savedIds = kvdb.get(PARTY_IDS_KEY);

  return new Set(Array.isArray(savedIds) ? savedIds.map(String) : []);
}

// Provides the saved party's guest IDs and a function that replaces them. The
// Lightning Lane client is kept in step with the saved party.
export default function useSavedParty(): readonly [Set<string>, SavePartyIds] {
  const { ll } = use(ClientsContext);
  const [partyIds, setPartyIds] = useState(loadPartyIds);

  useEffect(() => {
    ll.setPartyIds([...partyIds]);
  }, [ll, partyIds]);

  const savePartyIds = useCallback<SavePartyIds>(
    newPartyIds => {
      kvdb.set(PARTY_IDS_KEY, [...newPartyIds]);
      ll.setPartyIds([...newPartyIds]);
      setPartyIds(newPartyIds);
    },
    [ll]
  );

  return [partyIds, savePartyIds];
}
