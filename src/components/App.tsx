import { FC, useCallback, useEffect, useState } from 'react';

import { AuthData, ReauthNeeded, authStore } from '@/api/auth';
import { InvalidOrigin } from '@/api/client';
import { LLClient } from '@/api/ll';
import { Resort, ResortId, loadResort } from '@/api/resort';
import { VQClient } from '@/api/vq';
import { siteUrl } from '@/config';
import ClientsContext, {
  Clients,
  createClients,
} from '@/contexts/ClientsContext';
import ResortContext from '@/contexts/ResortContext';
import { DateTime } from '@/datetime';
import useDisclaimer from '@/hooks/useDisclaimer';
import useNews from '@/hooks/useNews';
import { navigate } from '@/navigate';
import onVisible from '@/onVisible';

import LoginForm from './LoginForm';
import Merlock from './ll/Merlock';
import BGClient from './vq/BGClient';

export const NEWS_VERSION = 0;

const TIME_ZONES: Record<ResortId, string> = {
  WDW: 'America/New_York',
  DLR: 'America/Los_Angeles',
};

// The apps BG1 can run as. Which one runs depends on the Disney site BG1 is
// opened on, which each app's client maps to a resort.
const APPS = [
  {
    Client: LLClient,
    Component: Merlock,
  },
  {
    Client: VQClient,
    Component: BGClient,
  },
];

type LoadedApp = {
  Component: FC;
  resort: Resort;
  clients: Clients;
};

// Returns the app for the site BG1 is opened on, or undefined when no app
// runs on this site.
async function loadApp(): Promise<LoadedApp | undefined> {
  for (const { Client, Component } of APPS) {
    try {
      const resort = await loadResort(Client.originToResortId(origin));

      return {
        Component,
        resort,
        clients: createClients(resort),
      };
    } catch (error) {
      if (!(error instanceof InvalidOrigin)) {
        throw error;
      }
    }
  }

  return undefined;
}

function isReauthNeeded(): boolean {
  try {
    authStore.getData();
  } catch (error) {
    if (!(error instanceof ReauthNeeded)) {
      throw error;
    }

    return true;
  }

  return false;
}

// Mobile browsers don't zoom on a double tap when the body handles clicks.
function ignoreClick() {}

export default function App() {
  const [app, setApp] = useState<LoadedApp>();
  const [isLoginRequired, setIsLoginRequired] = useState(isReauthNeeded);
  const disclaimer = useDisclaimer();
  const news = useNews(NEWS_VERSION);

  useEffect(() => {
    document.body.addEventListener('click', ignoreClick);

    return () => {
      document.body.removeEventListener('click', ignoreClick);
    };
  }, []);

  useEffect(() => {
    authStore.onUnauthorized = () => setIsLoginRequired(true);

    return () => {
      authStore.onUnauthorized = () => undefined;
    };
  }, []);

  useEffect(() => {
    let isStale = false;

    async function startApp() {
      const loadedApp = await loadApp();

      if (isStale) {
        return;
      }

      if (!loadedApp) {
        navigate(siteUrl('start.html'));
        return;
      }

      DateTime.setTimeZone(TIME_ZONES[loadedApp.resort.id]);
      setApp(loadedApp);
    }

    startApp().catch(error => {
      console.error(error);
    });

    return () => {
      isStale = true;
    };
  }, []);

  useEffect(() => {
    function checkAuth() {
      if (isLoginRequired) {
        return;
      }

      try {
        authStore.getData();
      } catch {
        setIsLoginRequired(true);
      }
    }

    checkAuth();

    return onVisible(checkAuth);
  }, [isLoginRequired]);

  const logIn = useCallback((data: AuthData) => {
    authStore.setData(data);
    setIsLoginRequired(false);
  }, []);

  if (disclaimer) {
    return disclaimer;
  }

  if (news) {
    return news;
  }

  if (!app) {
    return <div />;
  }

  if (isLoginRequired) {
    return <LoginForm resort={app.resort} onLogin={logIn} />;
  }

  return (
    <ResortContext value={app.resort}>
      <ClientsContext value={app.clients}>
        <app.Component />
      </ClientsContext>
    </ResortContext>
  );
}
