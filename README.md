# BG1: An Unofficial Lightning Lane and Boarding Group Client

**WARNING! Use at your own risk. BG1 is highly experimental, for demonstration purposes only, and provided "as is" without warranty of any kind. It is in no way endorsed by or associated with the Walt Disney Company and could stop working at any time for any reason. To ensure the intended experience, always use the official Disney app.**

BG1 is an unofficial, experimental client for obtaining Lightning Lane Multi Pass reservations and virtual queue boarding groups at Disney theme parks in the United States. Read the [BG1 documentation](https://joelface.github.io/bg1/) to learn more.

## About this fork

This fork tracks the behavior of the newest upstream builds, including Lightning Lane booking, and adds auto booking: pick a range of return times on the booking screen and BG1 keeps checking until it can book one. Auto booking only runs while that screen stays open.

## Development

BG1 uses [pnpm](https://pnpm.io/).

- `pnpm install` installs dependencies.
- `pnpm start` runs the dev server at `https://localhost:3000/bg1/`.
- `pnpm build` writes the production build to `dist/`.
- `pnpm serve` runs the server that hosts `dist/` under `/bg1/`. Railway runs it on every push to `mickey`. Its API is open and rate limited per visitor; callers identify themselves with their own Disney login. It needs the variables listed under [Server](#server).
- `pnpm db:generate` writes a migration to `server/db/migrations/` after a change to `server/db/schema.ts`. The server applies pending migrations when it starts.
- `pnpm checkall` runs the tests, linter, format check, and type check.

The hosts BG1 depends on are listed in `src/config.ts`. The home page and the userscript live in `site/`; the address the userscript loads the app from is `HOME_URL` in `site/autoloader.user.js`.

The server also answers a few short links: `/install` (the userscript), `/wdw`, `/wdw/vq`, `/dlr`, and `/dlr/vq` (the Disney pages BG1 runs on).

## Server

Besides hosting the app, the server runs auto-book jobs: the app hands over a search (`POST /api/jobs`) and the server keeps checking and books the Lightning Lane after the phone is closed, then sends a push notification. Jobs live in Postgres, and each guest's Disney login is stored encrypted and deleted when its job ends.

| Variable                     | Required | Default                            | Purpose                                                                                                  |
| ---------------------------- | -------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | yes      |                                    | The Postgres database that holds the jobs.                                                               |
| `LOGIN_ENCRYPTION_KEY`       | yes      |                                    | 32 random bytes, base64 encoded. Encrypts stored logins; changing it makes running jobs fail.            |
| `VAPID_PUBLIC_KEY`           | yes      |                                    | Web Push public key, base64url encoded.                                                                  |
| `VAPID_PRIVATE_KEY`          | yes      |                                    | Web Push private key, base64url encoded.                                                                 |
| `VAPID_SUBJECT`              | yes      |                                    | The contact push services are given: an `https:` or `mailto:` URL.                                       |
| `AUTO_BOOK_POLL_INTERVAL_MS` | no       | `1000`                             | How long a job waits between two checks. At least `100`.                                                 |
| `DISNEY_REQUESTS_PER_SECOND` | no       | the lowest safe value for the pace | How many requests one job may send Disney per second before it stops itself. `8` at the default pace.    |
| `DISNEY_PROXIES`             | no       | none                               | `host:port:username:password` proxies, one per line or separated by commas. The probe tries one of them. |
| `DISNEY_USE_PROXIES`         | no       | `false`                            | `true` sends each job's requests to Disney through one of `DISNEY_PROXIES`.                              |
| `PORT`                       | no       | `8080`                             | The port to listen on.                                                                                   |
| `LOG_LEVEL`                  | no       | `info`                             | `debug`, `info`, `warn`, or `error`.                                                                     |
| `NODE_ENV`                   | no       | `development`                      | `production` writes logs as JSON.                                                                        |

## Acknowledgments

- **Len Testa:** For helping me get as close as I could ever reasonably expect to accomplish a not very serious childhood dream of almost being an Imagineer. Also for creating [Touring Plans](https://touringplans.com/), which is pretty rad.

- **Barry, Stacy, Jeff, Michelle, Jim, Stuart, Bob, Kimberly, Milissa, Jennifer, Erin & Erin, Kristina, Lemonia, Scott, Jorge, Phil, Kellianne, Joshua, Brandon, Megan, Jennifer, Gary, Alexander, and others:** For helping me test and improve BG1.

- **Arialvetica:** For creating the awesome BG1 logo.

- **[ThemeParks.wiki](https://themeparks.wiki/):** For the free API used for showtime data not available via Disney's tipboard.

- **[Thrill Data](https://www.thrill-data.com/):** For providing data used to help determine Lightning Lane priorities.

- **[IcoMoon](https://icomoon.io/#icons-icomoon):** For the free icons, provided under a [Creative Commons license](https://creativecommons.org/licenses/by/4.0/).
