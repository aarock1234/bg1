import { use } from 'react';

import ThemeContext, { Theme } from '@/contexts/ThemeContext';

import HeaderBar from './HeaderBar';

export type ScreenProps = {
  title: React.ReactNode;
  children: React.ReactNode;
  buttons?: React.ReactNode;
  subhead?: React.ReactNode;
  footer?: React.ReactNode;
  theme?: Theme;
  ref?: React.RefObject<HTMLDivElement | null>;
};

export type ScreenRef = {
  scroll: (x: number, y: number) => void;
};

export default function Screen({
  title,
  buttons,
  subhead,
  footer,
  theme,
  children,
  ref,
}: ScreenProps) {
  const inheritedTheme = use(ThemeContext);
  const screenTheme = theme ?? inheritedTheme;

  return (
    <ThemeContext value={screenTheme}>
      <div className="fixed inset-0 flex flex-col">
        <HeaderBar title={title} buttons={buttons} subhead={subhead} />
        <div ref={ref} className="relative flex-1 overflow-auto px-3 pb-5">
          {children}
        </div>
        {footer && (
          <div
            className={`relative ${screenTheme.bg} text-white font-semibold`}
          >
            {footer}
          </div>
        )}
      </div>
    </ThemeContext>
  );
}
