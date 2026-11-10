import { HOSTS } from '@/config';

const MS_PER_SECOND = 1000;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

// Answers the requests BG1 makes to its own backend (time sync, usage pings,
// show times), so the preview works offline and reports nothing. Every other
// request goes out as usual.
export function stubServiceRequests(): void {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!requestUrl(input).startsWith(HOSTS.SERVICE)) {
      return realFetch(input, init);
    }

    return new Response('{}', {
      headers: {
        'Content-Type': 'application/json',

        // The server's time in seconds, which the time sync reads.
        T: String(Date.now() / MS_PER_SECOND),
      },
    });
  };
}
