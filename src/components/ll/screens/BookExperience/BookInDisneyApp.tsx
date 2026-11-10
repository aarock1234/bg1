import { use } from 'react';

import ResortContext from '@/contexts/ResortContext';

import PartyList from './PartyList';
import { disneyAppLink } from './disney-app';

// Shown when Disney refuses to give BG1 an offer, which it does for every
// Lightning Lane at the moment. The guest can still watch for a time here and
// book it in the official app.
export default function BookInDisneyApp() {
  const resort = use(ResortContext);
  const app = disneyAppLink(resort.id);

  return (
    <>
      <div className="card mt-5">
        <h3 className="mt-0">Book in the {app.name}</h3>
        <p className="note">
          Disney doesn't let BG1 book Lightning Lanes right now. Watch for a
          return time below, then book it in the {app.name}.
        </p>
        <a
          href={app.url}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary btn-full"
        >
          Open the {app.name}
        </a>
      </div>
      <PartyList />
    </>
  );
}
