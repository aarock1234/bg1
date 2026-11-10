import { use, useLayoutEffect } from 'react';

import TabsContext from '@/contexts/TabContext';

import Screen, { ScreenProps } from './Screen';
import TabButton from './TabButton';

// A screen that belongs to a set of tabs. Its footer is the bottom navigation:
// one button per tab, followed by the footer given to withTabs, which should
// render items of the same shape (elements with the `tab` class).
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
        <nav className="tab-bar">
          {tabs.map(tab => (
            <TabButton {...tab} key={tab.name} />
          ))}
          {footer}
        </nav>
      }
      ref={ref}
    >
      {children}
    </Screen>
  );
}
