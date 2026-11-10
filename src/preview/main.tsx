import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { RESORT_TIME_ZONES } from '@/api/resort';
import { DateTime } from '@/datetime';

import '../bg1.css';
import PreviewApp from './PreviewApp';
import { PreviewWorld, createPreviewClients } from './clients';
import { pinParkTime } from './clock';
import { rankedFlexAttractions } from './data/experiences';
import { PlanBook, seedPlans } from './data/plans';
import { stubServiceRequests } from './network';
import { readPreviewOptions } from './options';
import { experiencesIn, findPark, loadPreviewResort } from './resort';
import { resetStoredState } from './storage';
import { tapInOrder } from './tap';

// Which of the park's attractions, by popularity, starts out as a favorite.
const FAVORITE_RANK = 7;

main().catch(error => {
  console.error('preview failed to start', error);
});

// Starts the development preview: the real screens, fed by fake clients, at a
// fixed time of day. See docs/design.md for the options it reads from the URL.
async function main() {
  const options = readPreviewOptions(location.search);

  DateTime.setTimeZone(RESORT_TIME_ZONES[options.resortId]);
  pinParkTime(options.time);
  stubServiceRequests();

  const previewResort = await loadPreviewResort(options.resortId);
  const park = findPark(previewResort.resort, options.park);
  const favorite = rankedFlexAttractions(experiencesIn(previewResort, park))[
    FAVORITE_RANK
  ];

  resetStoredState({
    tab: options.tab,
    parkId: park.id,
    starredIds: favorite ? [favorite.id] : [],
  });

  const world: PreviewWorld = {
    previewResort,
    scenario: options.scenario,
    plans: new PlanBook(seedPlans(previewResort)),
  };
  const container = document.createElement('div');
  document.body.append(container);

  createRoot(container).render(
    <StrictMode>
      <PreviewApp
        world={world}
        clients={createPreviewClients(world)}
        options={options}
      />
    </StrictMode>
  );

  await tapInOrder(options.taps);
}
