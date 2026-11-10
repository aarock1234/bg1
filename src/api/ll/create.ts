import type { LLClient, LLClientOptions } from '../ll';
import type { Resort } from '../resort';
import { LLClientDLR } from './dlr';
import { LLClientWDW } from './wdw';

// Creates the Lightning Lane client for a resort's booking system.
export function createLLClient(
  resort: Resort,
  options?: LLClientOptions
): LLClient {
  if (resort.id === 'WDW') {
    return new LLClientWDW(resort, options);
  }

  return new LLClientDLR(resort, options);
}
