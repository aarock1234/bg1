import { useEffect } from 'react';

import { AuthData } from '@/api/auth';
import { Resort } from '@/api/resort';
import { siteUrl } from '@/config';

const SCRIPT_URL = 'https://cdn.registerdisney.go.com/v4/OneID.js';
const SCRIPT_ID = 'oneid-script';
const WRAPPER_ID = 'oneid-wrapper';

type OneIdConfig = {
  clientId: string;
  responderPage: string;
};

type OneIdToken = {
  swid: string;
  access_token: string;
  exp: string | number;
  refresh_token?: string;
  refresh_exp?: string | number;
};

type OneIdLogin = {
  token: OneIdToken;
};

type OneIdEventType = 'login' | 'close';

type OneIdClient = {
  init(): Promise<void>;
  launchLogin(): void;
  on(type: 'login', listener: (login: OneIdLogin) => void): void;
  on(type: 'close', listener: () => void): void;
  // Removes every listener of the type.
  off(type: OneIdEventType): void;
};

type OneIdSession = {
  client: OneIdClient;
  clientId: string;
};

declare global {
  interface Window {
    OneID?: {
      get(config: OneIdConfig): OneIdClient;
    };
  }
}

// The OneID script is loaded and its client created only once per page, no
// matter how often the login form is shown.
let sessionPromise: Promise<OneIdSession> | undefined;

function toAuthData(token: OneIdToken): AuthData {
  const authData: AuthData = {
    swid: token.swid,
    accessToken: token.access_token,
    expires: new Date(token.exp).getTime(),
  };

  if (token.refresh_token && token.refresh_exp !== undefined) {
    authData.refreshToken = token.refresh_token;
    authData.refreshExpires = new Date(token.refresh_exp).getTime();
  }

  return authData;
}

async function launchLogin(
  resortId: string,
  onLogin: (data: AuthData) => void
): Promise<void> {
  const { client, clientId } = await loadSession(resortId);

  client.off('login');
  client.on('login', ({ token }) => {
    onLogin(toAuthData(token));
    deleteGuestData(clientId);
  });

  // The login form can't be dismissed: closing it opens it again.
  client.off('close');
  client.on('close', () => {
    client.launchLogin();
  });

  client.launchLogin();
}

function loadSession(resortId: string): Promise<OneIdSession> {
  sessionPromise ??= createSession(resortId);

  return sessionPromise;
}

async function createSession(resortId: string): Promise<OneIdSession> {
  await loadOneIdScript();

  if (!self.OneID) {
    throw new Error('OneID script loaded without defining OneID');
  }

  const platform = navigator.userAgent.includes('Android') ? 'AND' : 'IOS';
  const clientId = `TPR-${resortId}-LBSDK.${platform}`;
  const client = self.OneID.get({
    clientId,
    responderPage: siteUrl('responder.html'),
  });

  await client.init();
  deleteGuestData(clientId);

  return {
    client,
    clientId,
  };
}

function loadOneIdScript(): Promise<void> {
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = SCRIPT_URL;
  document.head.append(script);

  return new Promise(resolve => {
    script.addEventListener('load', () => {
      resolve();
    });
  });
}

// Removes the guest data that OneID keeps in local storage.
function deleteGuestData(clientId: string) {
  localStorage.removeItem(`${clientId}-PROD.guest`);
}

type LoginFormProps = {
  resort: Pick<Resort, 'id'>;
  onLogin: (data: AuthData) => void;
};

// Shows Disney's own login form on top of the page. It renders nothing
// itself.
export default function LoginForm({ resort, onLogin }: LoginFormProps) {
  useEffect(() => {
    launchLogin(resort.id, onLogin).catch(error => {
      console.error(error);
    });
  }, [resort, onLogin]);

  useEffect(() => {
    return () => {
      document.getElementById(WRAPPER_ID)?.remove();
    };
  }, []);

  return null;
}
