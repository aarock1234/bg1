import { JSX, ReactNode, use, useEffect, useRef } from 'react';

import NavContext from '@/contexts/NavContext';

type DeepLinkProps = {
  // Builds the screen to open on top of the first one.
  open: () => Promise<JSX.Element>;

  // The app's first screen, which the Back button returns to.
  children: ReactNode;
};

// Opens a screen as soon as the app has started, the way tapping through to
// it would. Must be rendered inside a NavProvider.
export default function DeepLink({ open, children }: DeepLinkProps) {
  const { goTo } = use(NavContext);
  const hasOpened = useRef(false);

  useEffect(() => {
    if (hasOpened.current) {
      return;
    }

    hasOpened.current = true;

    open()
      .then(screen => goTo(screen))
      .catch(error => {
        console.error('preview screen could not be opened', error);
      });
  }, [open, goTo]);

  return children;
}
