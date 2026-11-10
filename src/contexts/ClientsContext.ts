import { createContext } from 'react';

import { DasClient } from '@/api/das';
import { ItineraryClient } from '@/api/itinerary';
import { LiveDataClient } from '@/api/livedata';
import { LLClient } from '@/api/ll';
import { LLClientDLR } from '@/api/ll/dlr';
import { LLClientWDW } from '@/api/ll/wdw';
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

export function createClients(resort: Resort): Clients {
  const LLClientForResort = resort.id === 'WDW' ? LLClientWDW : LLClientDLR;

  const das = new DasClient(resort);
  const itinerary = new ItineraryClient(resort);
  const liveData = new LiveDataClient(resort);
  const ll = new LLClientForResort(resort);
  const vq = new VQClient(resort);

  itinerary.onRefresh = bookings => ll.track(bookings);

  return {
    das,
    itinerary,
    liveData,
    ll,
    vq,
  };
}
