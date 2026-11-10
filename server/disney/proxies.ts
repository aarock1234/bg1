import { ProxyAgent, fetch as undiciFetch } from 'undici';

const PROXY_FIELD_COUNT = 4;

// A proxy written as `host:port:username:password`, the format proxy
// providers hand out.
function toProxyUrl(line: string): string {
  const fields = line.split(':');
  const [host, port, username, password] = fields;

  if (fields.length !== PROXY_FIELD_COUNT || !host || !port) {
    throw new Error('proxy must be written as host:port:username:password');
  }

  const credentials = `${encodeURIComponent(username ?? '')}:${encodeURIComponent(password ?? '')}`;

  return `http://${credentials}@${host}:${port}`;
}

// Parses a list of proxies, one per line or separated by commas.
export function parseProxies(list: string): string[] {
  return list
    .split(/[\n,]/)
    .map(line => line.trim())
    .filter(line => line !== '')
    .map(toProxyUrl);
}

export type ProxiedFetch = {
  fetch: typeof fetch;

  // Closes the connections kept open to the proxy.
  close(): Promise<void>;
};

// Returns a fetch that sends every request through one randomly chosen proxy,
// so that a client keeps a single address for as long as it lives. Whoever
// asks for it closes it when the client is done.
export function proxiedFetch(proxyUrls: string[]): ProxiedFetch {
  const proxyUrl = proxyUrls[Math.floor(Math.random() * proxyUrls.length)];

  if (!proxyUrl) {
    throw new Error('no proxies are configured');
  }

  const dispatcher = new ProxyAgent(proxyUrl);

  // undici's fetch is the one that accepts a dispatcher. Its request and
  // response types mirror the global fetch's but are declared separately,
  // hence the casts between them.
  return {
    fetch: (input, init) => {
      const response = undiciFetch(input as Parameters<typeof undiciFetch>[0], {
        ...(init as Parameters<typeof undiciFetch>[1]),
        dispatcher,
      });

      return response as unknown as Promise<Response>;
    },
    close: () => dispatcher.close(),
  };
}
