import { ReactNode, useState } from 'react';

import FloatingButton from '@/components/FloatingButton';
import News from '@/components/screens/News';
import kvdb from '@/kvdb';

export const NEWS_VERSION_KEY = 'bg1.news.version';

function loadLastSeenVersion(): number {
  const savedVersion = Number(kvdb.get(NEWS_VERSION_KEY));

  return Number.isInteger(savedVersion) ? savedVersion : 0;
}

// Returns the news screen until the user has closed this version of the news,
// then null.
export default function useNews(version: number): ReactNode {
  const [lastSeenVersion, setLastSeenVersion] = useState(loadLastSeenVersion);

  function markAsSeen() {
    kvdb.set(NEWS_VERSION_KEY, version);
    setLastSeenVersion(version);
  }

  if (lastSeenVersion >= version) {
    return null;
  }

  return (
    <>
      <News />
      <FloatingButton onClick={markAsSeen}>Close</FloatingButton>
    </>
  );
}
