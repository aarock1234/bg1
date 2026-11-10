import type { Auth } from '@/api/auth';
import type { LLClient, LLClientOptions } from '@/api/ll';
import { createLLClient } from '@/api/ll/create';
import { type Resort, type ResortId, loadResort } from '@/api/resort';

// The browser app remembers which experiences a guest has used so it can mark
// them in its list. The server has no list to mark.
const NO_TRACKING: NonNullable<LLClientOptions['tracker']> = {
  experienced: () => false,
  update: async () => undefined,
};

const resorts = new Map<ResortId, Promise<Resort>>();

// Loads each resort's data once and shares it between clients.
export function resortFor(resortId: ResortId): Promise<Resort> {
  let resort = resorts.get(resortId);

  if (!resort) {
    resort = loadResort(resortId);
    resorts.set(resortId, resort);
  }

  return resort;
}

type ServerClientOptions = Omit<LLClientOptions, 'auth' | 'tracker'>;

// Creates a Lightning Lane client that acts as the guest whose login `auth`
// serves.
export async function llClientFor(
  resortId: ResortId,
  auth: Auth,
  options: ServerClientOptions = {}
): Promise<LLClient> {
  return createLLClient(await resortFor(resortId), {
    ...options,
    auth,
    tracker: NO_TRACKING,
  });
}
