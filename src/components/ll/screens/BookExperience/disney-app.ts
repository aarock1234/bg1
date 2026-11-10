import type { ResortId } from '@/api/resort';

type DisneyApp = {
  name: string;

  // A URL scheme the iPhone app registers, which opens it. Disney publishes
  // none for its own links, so this is one the app reports for itself, and
  // only known for Disneyland.
  iosScheme?: string;
  androidPackage: string;
  appStoreUrl: string;
};

// The official app guests book Lightning Lanes in at each resort.
const DISNEY_APPS: Record<ResortId, DisneyApp> = {
  DLR: {
    name: 'Disneyland app',
    iosScheme: 'cs-com.disney.DLR',
    androidPackage: 'com.disney.wdpro.dlr',
    appStoreUrl: 'https://apps.apple.com/app/id1022164656',
  },
  WDW: {
    name: 'My Disney Experience app',
    androidPackage: 'com.disney.wdw.android',
    appStoreUrl: 'https://apps.apple.com/app/id547436543',
  },
};

export type DisneyAppLink = {
  name: string;

  // Opens the app when it is installed.
  openUrl: string;

  // The store page, for getting the app.
  storeUrl: string;
};

function isAndroid(): boolean {
  return navigator.userAgent.includes('Android');
}

function playStoreUrl(app: DisneyApp): string {
  return `https://play.google.com/store/apps/details?id=${app.androidPackage}`;
}

// Chrome on Android opens the app with this, or its Play Store page when the
// app isn't installed.
function androidIntentUrl(app: DisneyApp): string {
  return `intent://#Intent;package=${app.androidPackage};S.browser_fallback_url=${encodeURIComponent(playStoreUrl(app))};end`;
}

// Where to send the guest to open the resort's app. Disney publishes no link
// into either app: Walt Disney World's universal link file only covers pass
// renewals, and Disneyland doesn't publish one. Without a known way to open
// the app, the store page is used, whose Open button leads into it.
export function disneyAppLink(resortId: ResortId): DisneyAppLink {
  const app = DISNEY_APPS[resortId];

  if (isAndroid()) {
    return {
      name: app.name,
      openUrl: androidIntentUrl(app),
      storeUrl: playStoreUrl(app),
    };
  }

  return {
    name: app.name,
    openUrl: app.iosScheme ? `${app.iosScheme}://` : app.appStoreUrl,
    storeUrl: app.appStoreUrl,
  };
}
