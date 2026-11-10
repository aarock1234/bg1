import { RESORT_IDS, ResortId } from '@/api/resort';
import { ParkTime } from '@/datetime';

// - ll: the Lightning Lane app
// - vq: the virtual queue app
// - kit: every shared building block on one page
// - login, disclaimer, news: the screens shown before either app starts
export const APP_NAMES = [
  'll',
  'vq',
  'kit',
  'login',
  'disclaimer',
  'news',
] as const;

export type AppName = (typeof APP_NAMES)[number];

// What the fake clients answer with:
// - default: realistic data
// - empty: nothing to show (no experiences, plans, queues, or guests)
// - sold-out: no Lightning Lane return times are on offer
// - ineligible: nobody in the party can book
// - error: every request fails
// - loading: no request ever finishes
export const SCENARIOS = [
  'default',
  'empty',
  'sold-out',
  'ineligible',
  'error',
  'loading',
] as const;

export type Scenario = (typeof SCENARIOS)[number];

// The time of day the preview pretends it is, so that screenshots look the
// same whenever they are taken.
const DEFAULT_TIME = '10:05';

export type PreviewOptions = {
  // The app to show. Without one, the preview lists what it can show.
  app: AppName | undefined;

  // A screen to open on top of the app's first screen.
  screen: string | undefined;

  // Which experience, plan, or queue the screen is for.
  id: string | undefined;

  // The Lightning Lane home tab to start on.
  tab: string | undefined;

  // The name of the park to start in.
  park: string | undefined;

  // Controls to tap once the app has loaded, in order, each named by its
  // title, label, or text.
  taps: string[];

  resortId: ResortId;
  scenario: Scenario;
  time: ParkTime;
};

function oneOf<T extends string>(
  values: readonly T[],
  value: string | null
): T | undefined {
  return values.find(candidate => candidate === value);
}

// Reads the preview's options from the page's query string, such as
// `?app=ll&screen=book&scenario=sold-out`.
export function readPreviewOptions(search: string): PreviewOptions {
  const params = new URLSearchParams(search);

  return {
    app: oneOf(APP_NAMES, params.get('app')),
    screen: params.get('screen') ?? undefined,
    id: params.get('id') ?? undefined,
    tab: params.get('tab') ?? undefined,
    park: params.get('park') ?? undefined,
    taps: params.getAll('tap'),
    resortId: oneOf(RESORT_IDS, params.get('resort')) ?? 'WDW',
    scenario: oneOf(SCENARIOS, params.get('scenario')) ?? 'default',
    time: ParkTime.from(params.get('time') ?? DEFAULT_TIME),
  };
}
