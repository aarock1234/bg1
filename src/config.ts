// External hosts BG1 depends on, kept in one place so a deployment can point
// them elsewhere without touching the code that calls them.
export const HOSTS = {
  // Static pages published alongside the app: start, responder, and news.
  SITE: 'https://joelface.github.io/bg1',

  // BG1 backend: ping, time sync, live data, and sensor data.
  SERVICE: 'https://bg1.joelface.com',
} as const;

export function siteUrl(page: string): string {
  return `${HOSTS.SITE}/${page}`;
}

export function serviceUrl(path: string): string {
  return `${HOSTS.SERVICE}/${path}`;
}
