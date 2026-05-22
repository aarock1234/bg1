import { createContext } from 'react';

export interface Screens {
  activeScreen: React.ReactNode;
  prevScreen?: React.ReactNode;
}

export default createContext<Screens>({ activeScreen: null });
