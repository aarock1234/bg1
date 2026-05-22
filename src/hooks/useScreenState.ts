import { use, useState } from 'react';

import ScreensContext from '@/contexts/ScreensContext';

export default function useScreenState() {
  const { activeScreen, prevScreen } = use(ScreensContext);
  const [thisScreen] = useState(activeScreen);
  const [isFirstScreen] = useState(!prevScreen);
  return { isActiveScreen: activeScreen === thisScreen, isFirstScreen };
}
