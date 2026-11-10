import { use, useState } from 'react';

import ScreensContext from '@/contexts/ScreensContext';

type ScreenState = {
  isActiveScreen: boolean;
  isFirstScreen: boolean;
};

// Describes the screen that calls it. A screen is the active one when it
// first renders, so that is when its identity and position are captured.
export default function useScreenState(): ScreenState {
  const { activeScreen, prevScreen } = use(ScreensContext);
  const [thisScreen] = useState(activeScreen);
  const [isFirstScreen] = useState(!prevScreen);

  return {
    isActiveScreen: activeScreen === thisScreen,
    isFirstScreen,
  };
}
