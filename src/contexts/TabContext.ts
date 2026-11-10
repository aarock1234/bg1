import { FC, ReactNode, createContext } from 'react';

export type TabDef<Name extends string> = {
  name: Name;
  icon: ReactNode;
  // Each tab's component declares its own props, so no single props type
  // describes them all.
  component: FC<any>;
};

// Remembers how far the active tab is scrolled.
type ScrollPos = {
  get: () => number;
  set: (pos: number) => void;
};

type TabState<Name extends string> = {
  tabs: TabDef<Name>[];
  active: TabDef<Name>;
  changeTab: (tab: Name) => void;
  scrollPos: ScrollPos;
  footer?: ReactNode;
};

export default createContext<TabState<string>>({
  tabs: [],
  active: {
    name: '',
    icon: null,
    component: () => null,
  },
  changeTab: () => undefined,
  scrollPos: {
    get: () => 0,
    set: () => undefined,
  },
});
