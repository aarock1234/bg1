import { use, useEffect, useRef } from 'react';

import withTabs from '@/components/withTabs';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import ParkContext from '@/contexts/ParkContext';
import PlansContext from '@/contexts/PlansContext';
import RebookingContext from '@/contexts/RebookingContext';
import { TabDef } from '@/contexts/TabContext';
import ThemeContext from '@/contexts/ThemeContext';
import useScreenState from '@/hooks/useScreenState';
import CalendarIcon from '@/icons/CalendarIcon';
import ClockIcon from '@/icons/ClockIcon';
import LightningIcon from '@/icons/LightningIcon';
import kvdb from '@/kvdb';
import onVisible from '@/onVisible';

import MultiPassList from './Home/MultiPassList';
import SettingsButton from './Home/SettingsButton';
import TimesGuide from './Home/TimesGuide';
import Plans from './Plans';

// Returning to the app refreshes data that is at least this old.
const AUTO_REFRESH_MIN_MS = 60_000;

export const HOME_TAB_KEY = 'bg1.tab';

export type HomeTabProps = {
  ref: React.RefObject<HTMLDivElement | null>;
};

const tabs = [
  {
    name: 'LL' as const,
    icon: <LightningIcon className="w-5.5" />,
    component: MultiPassList,
  },
  {
    name: 'Times' as const,
    icon: <ClockIcon className="w-5.5" />,
    component: TimesGuide,
  },
  {
    name: 'Plans' as const,
    icon: <CalendarIcon className="w-5.5" />,
    component: Plans,
  },
];

type TabName = (typeof tabs)[number]['name'];

const DEFAULT_TAB_NAME: TabName = 'LL';

// Shown as the last item of the bottom navigation, after the tabs.
const footer = <SettingsButton />;

function isTabName(name: unknown): name is TabName {
  return tabs.some(tab => tab.name === name);
}

function getSavedTabName(): TabName {
  const tabName = kvdb.get(HOME_TAB_KEY);

  return isTabName(tabName) ? tabName : DEFAULT_TAB_NAME;
}

type ActiveTabProps = {
  tab: TabDef<TabName>;
};

function ActiveTab({ tab }: ActiveTabProps) {
  const { isActiveScreen } = useScreenState();
  const rebooking = use(RebookingContext);
  const { park } = use(ParkContext);
  const { refreshExperiences } = use(ExperiencesContext);
  const { refreshPlans } = use(PlansContext);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    kvdb.set(HOME_TAB_KEY, tab.name);
  }, [tab]);

  useEffect(() => {
    return onVisible(() => {
      if (!isActiveScreen) {
        return;
      }

      refreshExperiences(AUTO_REFRESH_MIN_MS);
      refreshPlans(AUTO_REFRESH_MIN_MS);
    });
  }, [isActiveScreen, refreshExperiences, refreshPlans]);

  useEffect(() => {
    if (rebooking.current) {
      ref.current?.scroll(0, 0);
    }
  }, [rebooking]);

  return (
    <ThemeContext value={park.theme}>
      <tab.component ref={ref} />
    </ThemeContext>
  );
}

const Home = Object.assign(
  withTabs(
    {
      tabs,
      footer,
    },
    ActiveTab
  ),
  {
    getSavedTabName,
  }
);

export default Home;
