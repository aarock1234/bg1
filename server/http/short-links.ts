import { ApiClient } from '@/api/client';
import { VQClient } from '@/api/vq';

// The Disney pages the autoloader script replaces with BG1.
const LIGHTNING_LANE_PATH = '/vas/';
const VIRTUAL_QUEUE_PATH = '/application/v1/guest/getQueues';

// Short paths on BG1's own site and where each one leads.
export const SHORT_LINKS: Record<string, string> = {
  '/install': '/autoloader.user.js',
  '/wdw': `${ApiClient.originFor('WDW')}${LIGHTNING_LANE_PATH}`,
  '/wdw/vq': `${VQClient.originFor('WDW')}${VIRTUAL_QUEUE_PATH}`,
  '/dlr': `${ApiClient.originFor('DLR')}${LIGHTNING_LANE_PATH}`,
  '/dlr/vq': `${VQClient.originFor('DLR')}${VIRTUAL_QUEUE_PATH}`,
};
