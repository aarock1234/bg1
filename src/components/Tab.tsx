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

  useLayoutEffect(() => {
    const elem = ref?.current;
    if (!elem) return;
    elem.scroll(0, scrollPos.get());
    const updateScrollPos = () => scrollPos.set(elem.scrollTop);
    elem.addEventListener('scroll', updateScrollPos);
    return () => elem.removeEventListener('scroll', updateScrollPos);
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
