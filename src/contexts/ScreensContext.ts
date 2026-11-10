import { ReactNode, createContext } from 'react';

export type Screens = {
  activeScreen: ReactNode;
  prevScreen?: ReactNode;
};

export default createContext<Screens>({
  activeScreen: null,
});
