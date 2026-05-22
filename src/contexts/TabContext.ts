import { createContext } from 'react';

export interface TabDef<Name extends string> {
  name: Name;
  icon: React.ReactNode;
  component: React.FC<any>;
}

interface Context<N extends string> {
  tabs: TabDef<N>[];
  active: TabDef<N>;
  changeTab: (tab: N) => void;
  scrollPos: {
    get: () => number;
    set: (pos: number) => void;
  };
  footer?: React.ReactNode;
}

export default createContext<Context<string>>({
  tabs: [],
  active: {
    name: '',
    icon: null,
    component: () => null,
  },
  changeTab: () => {},
  scrollPos: { get: () => 0, set: () => {} },
});
