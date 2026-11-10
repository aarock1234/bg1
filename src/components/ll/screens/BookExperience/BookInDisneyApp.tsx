import { use } from 'react';

import ResortContext from '@/contexts/ResortContext';

import OpenDisneyApp from './OpenDisneyApp';
import PartyList from './PartyList';
import { disneyAppLink } from './disney-app';

// Shown when Disney refuses to give BG1 an offer, which it does for every
// Lightning Lane at the moment. The guest can still watch for a time here and
// book it in the official app.
export default function BookInDisneyApp() {
  const resort = use(ResortContext);
  const { name } = disneyAppLink(resort.id);

  return (
    <>
      <div className="card mt-5">
        <h3 className="mt-0">Book in the {name}</h3>
        <p className="note mb-0">
          Disney doesn't let BG1 book Lightning Lanes right now. Watch for a
          return time below, then book it in the {name}.
        </p>
        <OpenDisneyApp resortId={resort.id} />
      </div>
      <PartyList />
    </>
  );
}
