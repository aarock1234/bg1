import type { ResortId } from '@/api/resort';

type DisneyApp = {
  name: string;
  appStoreUrl: string;
  playStoreUrl: string;
};

// The official app guests book Lightning Lanes in at each resort.
const DISNEY_APPS: Record<ResortId, DisneyApp> = {
  DLR: {
    name: 'Disneyland app',
    appStoreUrl: 'https://apps.apple.com/app/id1022164656',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.disney.wdpro.dlr',
  },
  WDW: {
    name: 'My Disney Experience app',
    appStoreUrl: 'https://apps.apple.com/app/id547436543',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.disney.wdw.android',
  },
};

export type DisneyAppLink = {
  name: string;
  url: string;
};

// Where to send the guest to open the resort's app. The store page offers an
// Open button when the app is installed, which is the one route into the app
// that works on every phone.
export function disneyAppLink(resortId: ResortId): DisneyAppLink {
  const app = DISNEY_APPS[resortId];
  const isAndroid = navigator.userAgent.includes('Android');

  return {
    name: app.name,
    url: isAndroid ? app.playStoreUrl : app.appStoreUrl,
  };
}
