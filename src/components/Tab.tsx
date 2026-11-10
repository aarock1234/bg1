import { use, useLayoutEffect } from 'react';

import TabsContext from '@/contexts/TabContext';

import Screen, { ScreenProps } from './Screen';
import TabButton from './TabButton';

export default function Tab({
  title,
  buttons,
  subhead,
  children,
  ref,
}: ScreenProps) {
  const { tabs, scrollPos, footer } = use(TabsContext);

  // Restores the tab's scroll position when it is shown again, and keeps
  // track of it while the tab is scrolled.
  useLayoutEffect(() => {
    const scrollElem = ref?.current;

    if (!scrollElem) {
      return;
    }

    const updateScrollPos = () => scrollPos.set(scrollElem.scrollTop);

    scrollElem.scroll(0, scrollPos.get());
    scrollElem.addEventListener('scroll', updateScrollPos);

    return () => scrollElem.removeEventListener('scroll', updateScrollPos);
  }, [scrollPos, ref]);

  return (
    <Screen
      title={title}
      buttons={buttons}
      subhead={subhead}
      footer={
        <>
          <div className="flex items-center justify-center">
            {tabs.map(tab => (
              <TabButton {...tab} key={tab.name} />
            ))}
          </div>
          {footer}
        </>
      }
      ref={ref}
    >
      {children}
    </Screen>
  );
}
