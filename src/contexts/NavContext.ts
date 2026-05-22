import { createContext } from 'react';

export class NavError extends Error {
  readonly name = 'NavError';
}

export interface NavMethods {
  goTo: (elem: React.JSX.Element, options?: { replace?: boolean }) => void;
  goBack: <P>(options?: {
    screen?: React.FC<P>;
    props?: Partial<P>;
  }) => Promise<void>;
}

export default createContext<NavMethods>({
  goTo: () => undefined,
  goBack: async () => undefined,
});
