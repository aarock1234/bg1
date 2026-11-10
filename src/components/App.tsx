import { FC, useCallback, useEffect, useState } from 'react';

import { AuthData, ReauthNeeded, authStore } from '@/api/auth';
import { InvalidOrigin } from '@/api/client';
import { LLClient } from '@/api/ll';
import { RELAY_OPTIONS } from '@/api/relay';
import { RESORT_TIME_ZONES, Resort, loadResort } from '@/api/resort';
import { VQClient } from '@/api/vq';
import { HOME_URL } from '@/config';
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
import { WEB_ROUTE, WebRoute } from '@/web-route';

import LoginForm from './LoginForm';
import TryAgain from './TryAgain';
import Merlock from './ll/Merlock';
import BGClient from './vq/BGClient';

export const NEWS_VERSION = 0;

// The apps BG1 can run as. On Disney's pages, which one runs depends on the
// site BG1 is opened on, which each app's client maps to a resort.
const APPS = [
  {
    kind: 'll',
    Client: LLClient,
    Component: Merlock,
  },
  {
    kind: 'vq',
    Client: VQClient,
    Component: BGClient,
  },
] as const;

type LoadedApp = {
  Component: FC;
  resort: Resort;
  clients: Clients;
};

// Loads the app a page on BG1's own site asks for. Its requests to Disney go
// through BG1's server.
async function loadWebApp(route: WebRoute): Promise<LoadedApp | undefined> {
  const app = APPS.find(({ kind }) => kind === route.app);

  if (!app) {
    return undefined;
  }

  const resort = await loadResort(route.resortId);

  return {
    Component: app.Component,
    resort,
    clients: createClients(resort, RELAY_OPTIONS),
  };
}

// Returns the app for the page BG1 is opened on, or undefined when no app
// runs there.
async function loadApp(): Promise<LoadedApp | undefined> {
  if (WEB_ROUTE) {
    return loadWebApp(WEB_ROUTE);
  }

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

type StartupProps = {
  children: React.ReactNode;
};

// What is on screen before an app's first screen: BG1's name, and under it
// what the guest is waiting for. Disney's login form opens on top of it.
function Startup({ children }: StartupProps) {
  return (
    <div className="screen items-center justify-center gap-5 px-gutter text-center">
      <div className="text-[28px] leading-none font-bold tracking-tight">
        BG1
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const [app, setApp] = useState<LoadedApp>();

  // Starting is tried again each time this number changes.
  const [startAttempt, setStartAttempt] = useState(1);
  const [hasStartFailed, setHasStartFailed] = useState(false);
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
      setHasStartFailed(false);

      const loadedApp = await loadApp();

      if (isStale) {
        return;
      }

      if (!loadedApp) {
        navigate(HOME_URL);
        return;
      }

      DateTime.setTimeZone(RESORT_TIME_ZONES[loadedApp.resort.id]);
      setApp(loadedApp);
    }

    startApp().catch(error => {
      console.error(error);

      if (!isStale) {
        setHasStartFailed(true);
      }
    });

    return () => {
      isStale = true;
    };
  }, [startAttempt]);

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

  if (!app && hasStartFailed) {
    return (
      <Startup>
        <TryAgain
          title="BG1 Couldn't Start"
          onRetry={() => setStartAttempt(attempt => attempt + 1)}
        />
      </Startup>
    );
  }

  if (!app) {
    return (
      <Startup>
        <div className="spinner" role="status" aria-label="Starting BG1" />
      </Startup>
    );
  }

  if (isLoginRequired) {
    return (
      <Startup>
        <p className="note my-0 max-w-64">
          Log in with your Disney account to continue.
        </p>
        <LoginForm resort={app.resort} onLogin={logIn} />
      </Startup>
    );
  }

  return (
    <ResortContext value={app.resort}>
      <ClientsContext value={app.clients}>
        <app.Component />
      </ClientsContext>
    </ResortContext>
  );
}
