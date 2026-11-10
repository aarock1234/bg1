import { createContext } from 'react';

import { ApiClientOptions } from '@/api/client';
import { DasClient } from '@/api/das';
import { ItineraryClient } from '@/api/itinerary';
import { LiveDataClient } from '@/api/livedata';
import { LLClient } from '@/api/ll';
import { createLLClient } from '@/api/ll/create';
import { Resort } from '@/api/resort';
import { VQClient } from '@/api/vq';

export type Clients = {
  das: DasClient;
  itinerary: ItineraryClient;
  liveData: LiveDataClient;
  ll: LLClient;
  vq: VQClient;
};

// The default clients are empty stand-ins: every consumer renders below a
// provider that supplies the real clients for the resort.
export default createContext<Clients>({
  das: {} as DasClient,
  itinerary: {} as ItineraryClient,
  liveData: {} as LiveDataClient,
  ll: {} as LLClient,
  vq: {} as VQClient,
});

export function createClients(
  resort: Resort,
  options?: ApiClientOptions
): Clients {
  const das = new DasClient(resort, options);
  const itinerary = new ItineraryClient(resort, options);
  const liveData = new LiveDataClient(resort);
  const ll = createLLClient(resort, options);
  const vq = new VQClient(resort, options);

  itinerary.onRefresh = bookings => ll.track(bookings);

  return {
    das,
    itinerary,
    liveData,
    ll,
    vq,
  };
}
