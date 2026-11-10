import { useCallback, useMemo, useState } from 'react';

import { AuthData, ReauthNeeded, authStore } from '@/api/auth';
import { ProbeReport, ServerRequestFailed, runProbe } from '@/api/bg1-server';
import { RESORT_IDS, ResortId } from '@/api/resort';
import LoginForm from '@/components/LoginForm';
import kvdb from '@/kvdb';

// Which resort the stored Disney login was made for.
const LOGIN_RESORT_KEY = 'bg1.home.loginResort';

const MINUTES_PER_HOUR = 60;
const STATUS_TOO_MANY_REQUESTS = 429;

const RESORT_NAMES: Record<ResortId, string> = {
  WDW: 'Walt Disney World',
  DLR: 'Disneyland',
};

type CheckState =
  | {
      kind: 'idle';
    }
  | {
      kind: 'signing-in';
      resortId: ResortId;
    }
  | {
      kind: 'running';
    }
  | {
      kind: 'done';
      report: ProbeReport;
    }
  | {
      kind: 'failed';
      message: string;
    };

type ReportProps = {
  report: ProbeReport;
};

const IDLE: CheckState = {
  kind: 'idle',
};

// Returns the stored login when it is still usable and was made for the
// resort.
function storedLogin(resortId: ResortId): AuthData | undefined {
  if (kvdb.get(LOGIN_RESORT_KEY) !== resortId) {
    return undefined;
  }

  try {
    return authStore.getLogin();
  } catch (error) {
    if (error instanceof ReauthNeeded) {
      return undefined;
    }

    throw error;
  }
}

function failureMessage(error: unknown): string {
  if (!(error instanceof ServerRequestFailed)) {
    return 'Something unexpected went wrong.';
  }

  if (error.status === STATUS_TOO_MANY_REQUESTS) {
    return 'Too many checks in a row. Wait a minute and try again.';
  }

  return `The server couldn't be reached (status ${error.status}).`;
}

function formatMinutes(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} minutes`;
  }

  return `${Math.round(minutes / MINUTES_PER_HOUR)} hours`;
}

function Report({ report }: ReportProps) {
  const { checks, login } = report;

  return (
    <>
      <ul className="list checks">
        {checks.map(check => (
          <li key={check.name} className={check.ok ? 'check-ok' : 'check-bad'}>
            <strong>{check.name}</strong>
            <span>
              {check.detail} · {check.durationMs} ms
            </span>
          </li>
        ))}
      </ul>
      <p>
        Your Disney login lasts another {formatMinutes(login.expiresInMinutes)}
        {login.hasRefreshToken
          ? ' and can be renewed without signing in again.'
          : ' and then needs a new sign-in.'}
      </p>
    </>
  );
}

// Signs in to Disney from BG1's own site and asks the BG1 server whether
// Disney accepts its requests with that login.
export default function ServerCheck() {
  const [check, setCheck] = useState(IDLE);
  const signingInResortId =
    check.kind === 'signing-in' ? check.resortId : undefined;

  const runCheck = useCallback(async (resortId: ResortId, login: AuthData) => {
    setCheck({
      kind: 'running',
    });

    try {
      const report = await runProbe({
        resortId,
        login,
      });

      setCheck({
        kind: 'done',
        report,
      });
    } catch (error) {
      setCheck({
        kind: 'failed',
        message: failureMessage(error),
      });
    }
  }, []);

  const finishSignIn = useCallback(
    (login: AuthData) => {
      if (!signingInResortId) {
        return;
      }

      authStore.setData(login);
      kvdb.set(LOGIN_RESORT_KEY, signingInResortId);
      runCheck(signingInResortId, login);
    },
    [signingInResortId, runCheck]
  );

  const signingInResort = useMemo(() => {
    if (!signingInResortId) {
      return undefined;
    }

    return {
      id: signingInResortId,
    };
  }, [signingInResortId]);

  function startCheck(resortId: ResortId): void {
    const login = storedLogin(resortId);

    if (login) {
      runCheck(resortId, login);
      return;
    }

    setCheck({
      kind: 'signing-in',
      resortId,
    });
  }

  return (
    <>
      <p>Pick your resort and sign in to Disney.</p>
      <div className="button-pair">
        {RESORT_IDS.map(resortId => (
          <button
            key={resortId}
            type="button"
            className="button button-secondary button-wide"
            disabled={check.kind === 'running'}
            onClick={() => startCheck(resortId)}
          >
            {RESORT_NAMES[resortId]}
          </button>
        ))}
      </div>
      {check.kind === 'running' && <p role="status">Checking…</p>}
      {check.kind === 'failed' && <p role="alert">{check.message}</p>}
      {check.kind === 'done' && <Report report={check.report} />}
      {signingInResort && (
        <LoginForm resort={signingInResort} onLogin={finishSignIn} />
      )}
    </>
  );
}
