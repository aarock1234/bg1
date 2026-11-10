import { ReactNode, useState } from 'react';

import Disclaimer from '@/components/screens/Disclaimer';
import kvdb from '@/kvdb';

export const DISCLAIMER_ACCEPTED_KEY = 'bg1.disclaimer.accepted';

// The value stored once the disclaimer has been accepted.
const ACCEPTED = 1;

function isDisclaimerAccepted(): boolean {
  return Boolean(kvdb.get(DISCLAIMER_ACCEPTED_KEY));
}

// Returns the disclaimer screen until the user has accepted it, then null.
export default function useDisclaimer(): ReactNode {
  const [isAccepted, setIsAccepted] = useState(isDisclaimerAccepted);

  function accept() {
    kvdb.set(DISCLAIMER_ACCEPTED_KEY, ACCEPTED);
    setIsAccepted(true);
  }

  if (isAccepted) {
    return null;
  }

  return <Disclaimer onAccept={accept} />;
}
