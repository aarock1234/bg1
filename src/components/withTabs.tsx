import { FC, ReactNode, use, useCallback, useRef } from 'react';

import NavContext from '@/contexts/NavContext';
import TabsContext, { TabDef } from '@/contexts/TabContext';

type TabsConfig<Name extends string> = {
  tabs: TabDef<Name>[];
  footer: ReactNode;
};

type TabbedScreenProps<Name extends string> = {
  tab: TabDef<Name>;
};

type TabbedProps<Name extends string> = {
  tabName: Name;
};

// Turns a screen component into a set of tabs. The returned component shows
// the screen for the tab named by `tabName`, or for the first tab when there
// is no tab with that name.
export default function withTabs<Name extends string>(
  { tabs, footer }: TabsConfig<Name>,
  Component: FC<TabbedScreenProps<Name>>
) {
  return function Tabbed({ tabName }: TabbedProps<Name>) {
    const { goTo } = use(NavContext);
    const scrollPosByTabName = useRef<Record<string, number>>({});

    const changeTab = useCallback(
      (name: string) => {
        const tab = tabs.find(tab => tab.name === name);

        if (tab && tab.name !== tabName) {
          goTo(<Tabbed tabName={tab.name} />, {
            replace: true,
          });
        }
      },
      [tabName, goTo]
    );

    const active = tabs.find(tab => tab.name === tabName) ?? tabs[0];

    if (!active) {
      return null;
    }

    const scrollPos = {
      get() {
        return scrollPosByTabName.current[active.name] ?? 0;
      },

      set(pos: number) {
        scrollPosByTabName.current[active.name] = pos;
      },
    };

    return (
      <TabsContext
        value={{
          tabs,
          active,
          changeTab,
          scrollPos,
          footer,
        }}
      >
        <Component tab={active} />
      </TabsContext>
    );
  };
}
