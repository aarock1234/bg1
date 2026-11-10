import { FC, JSX, createContext } from 'react';

export class NavError extends Error {
  readonly name = 'NavError';
}

type GoToOptions = {
  // Shows the screen in place of the current one instead of after it.
  replace?: boolean;
};

type GoBackOptions<P> = {
  // Goes back to the most recent screen of this type instead of one step.
  screen?: FC<P>;
  // Props to override on the screen that is returned to.
  props?: Partial<P>;
};

export type NavMethods = {
  goTo: (elem: JSX.Element, options?: GoToOptions) => void;
  // Resolves once the earlier screen is active. Throws NavError when there is
  // no earlier screen of the requested type.
  goBack: <P>(options?: GoBackOptions<P>) => Promise<void>;
};

export default createContext<NavMethods>({
  goTo: () => undefined,
  goBack: async () => undefined,
});
