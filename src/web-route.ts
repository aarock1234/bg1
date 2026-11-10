import type { ResortId } from '@/api/resort';
import { HOSTS } from '@/config';

// Which of BG1's apps to run: Lightning Lane or virtual queues.
export type AppKind = 'll' | 'vq';

// What a page on BG1's own site should show. On Disney's pages, where the
// userscript loads BG1, the page's address decides that instead.
export type WebRoute = {
  resortId: ResortId;
  app: AppKind;
};

const WEB_ROUTES: Record<string, WebRoute> = {
  '/wdw': {
    resortId: 'WDW',
    app: 'll',
  },
  '/wdw/vq': {
    resortId: 'WDW',
    app: 'vq',
  },
  '/dlr': {
    resortId: 'DLR',
    app: 'll',
  },
  '/dlr/vq': {
    resortId: 'DLR',
    app: 'vq',
  },
};

// The paths on BG1's own site that run the app.
export const WEB_ROUTE_PATHS = Object.keys(WEB_ROUTES);

function currentWebRoute(): WebRoute | undefined {
  // The server shares this module and has no page address.
  if (typeof location === 'undefined' || location.origin !== HOSTS.HOME) {
    return undefined;
  }

  return WEB_ROUTES[location.pathname.replace(/\/$/, '')];
}

// The route of the page BG1 is running on, when that page is on BG1's own
// site. It is undefined on Disney's pages and on the server.
export const WEB_ROUTE = currentWebRoute();
