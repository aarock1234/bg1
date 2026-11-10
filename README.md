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
- `pnpm serve` runs the server that hosts `dist/` under `/bg1/`. Railway runs it on every push to `mickey`. It needs `API_SECRET` (32 characters or more) in its environment, which callers of `/api` present as a bearer token.
- `pnpm checkall` runs the tests, linter, format check, and type check.

The hosts BG1 depends on are listed in `src/config.ts`. The address the userscript loads the app from is `APP_URL` in `autoloader.user.js`.

## Acknowledgments

- **Len Testa:** For helping me get as close as I could ever reasonably expect to accomplish a not very serious childhood dream of almost being an Imagineer. Also for creating [Touring Plans](https://touringplans.com/), which is pretty rad.

- **Barry, Stacy, Jeff, Michelle, Jim, Stuart, Bob, Kimberly, Milissa, Jennifer, Erin & Erin, Kristina, Lemonia, Scott, Jorge, Phil, Kellianne, Joshua, Brandon, Megan, Jennifer, Gary, Alexander, and others:** For helping me test and improve BG1.

- **Arialvetica:** For creating the awesome BG1 logo.

- **[ThemeParks.wiki](https://themeparks.wiki/):** For the free API used for showtime data not available via Disney's tipboard.

- **[Thrill Data](https://www.thrill-data.com/):** For providing data used to help determine Lightning Lane priorities.

- **[IcoMoon](https://icomoon.io/#icons-icomoon):** For the free icons, provided under a [Creative Commons license](https://creativecommons.org/licenses/by/4.0/).
