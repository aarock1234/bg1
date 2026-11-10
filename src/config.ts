// External hosts BG1 depends on, kept in one place so a deployment can point
// them elsewhere without touching the code that calls them.
export const HOSTS = {
  // This fork's own site: the home page and the server-side API.
  HOME: 'https://bg1.abdels.dev',

  // Upstream's static pages: the login responder and the news.
  SITE: 'https://joelface.github.io/bg1',

  // Upstream's backend: ping, time sync, live data, and sensor data.
  SERVICE: 'https://bg1.joelface.com',
} as const;

// The page with setup steps and links into the Disney pages BG1 runs on.
export const HOME_URL = `${HOSTS.HOME}/`;

export function siteUrl(page: string): string {
  return `${HOSTS.SITE}/${page}`;
}

export function serviceUrl(path: string): string {
  return `${HOSTS.SERVICE}/${path}`;
}
