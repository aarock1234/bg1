import { ReactNode, useCallback, useState } from 'react';

import Spinner from '@/components/Spinner';
import useFlash, { ShowFlash } from '@/hooks/useFlash';
import { sleep } from '@/sleep';

// Keeps the spinner up long enough to register, even when a load is instant.
const MIN_LOAD_TIME_MS = 500;

const DEFAULT_MESSAGES = {
  error: 'Unknown error occurred',
  request: 'Network request failed',
};

// Messages to show when a load fails, by HTTP status or error name. `request`
// covers any other failed request, and `error` anything else.
export type FailureMessages = Partial<typeof DEFAULT_MESSAGES> &
  Record<string | number, string>;

export type LoadOptions = {
  messages?: FailureMessages;
  minLoadTimeMs?: number;
};

// Runs a load while showing a spinner, then flashes the outcome. A failed
// load resolves to undefined after its message is shown; it never rejects.
// The load can call `flash` to choose the message shown once it finishes.
export type DataLoader = <T>(
  load: (flash: ShowFlash) => Promise<T>,
  options?: LoadOptions
) => Promise<T | undefined>;

type DataLoaderHook = {
  loadData: DataLoader;
  loaderElem: ReactNode;
};

function responseStatus(error: Error): number | undefined {
  if (!('response' in error)) {
    return undefined;
  }

  const { response } = error;

  if (typeof response !== 'object' || response === null) {
    return undefined;
  }

  if ('status' in response && typeof response.status === 'number') {
    return response.status;
  }

  return undefined;
}

// Returns undefined for a failure that no message describes.
function failureMessage(
  error: unknown,
  messages: FailureMessages
): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const status = responseStatus(error);

  if (status !== undefined) {
    return messages[status] ?? messages.request;
  }

  return messages[error.name];
}

export default function useDataLoader(): DataLoaderHook {
  const [activeLoads, setActiveLoads] = useState(0);
  const [flashElem, flash] = useFlash();

  const loadData = useCallback<DataLoader>(
    async (load, options = {}) => {
      const messages = {
        ...DEFAULT_MESSAGES,
        ...options.messages,
      };
      const minLoadTime = sleep(options.minLoadTimeMs ?? MIN_LOAD_TIME_MS);

      let flashArgs: Parameters<ShowFlash> = [''];
      const flashWhenLoaded: ShowFlash = (...args) => {
        flashArgs = args;
      };

      flash('');
      setActiveLoads(count => count + 1);

      try {
        return await load(flashWhenLoaded);
      } catch (error) {
        const message = failureMessage(error, messages);

        if (message === undefined) {
          console.error(error);
        }

        flashArgs = [message ?? messages.error, 'error'];

        return undefined;
      } finally {
        await minLoadTime;
        setActiveLoads(count => count - 1);
        flash(...flashArgs);
      }
    },
    [flash]
  );

  const isLoading = activeLoads > 0;
  const loaderElem =
    isLoading || flashElem ? (
      <>
        {isLoading && <Spinner />}
        {flashElem}
      </>
    ) : null;

  return {
    loadData,
    loaderElem,
  };
}
