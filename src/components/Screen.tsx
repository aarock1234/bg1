import { use } from 'react';

import ThemeContext, { Theme } from '@/contexts/ThemeContext';

import HeaderBar from './HeaderBar';

export type ScreenProps = {
  title: React.ReactNode;
  children: React.ReactNode;
  buttons?: React.ReactNode;
  subhead?: React.ReactNode;
  footer?: React.ReactNode;

  // Screens are no longer painted in a park's colors. The theme is still
  // passed down for the components that read it from ThemeContext.
  theme?: Theme;

  ref?: React.RefObject<HTMLDivElement | null>;
};

export type ScreenRef = {
  scroll: (x: number, y: number) => void;
};

// A full-screen page: a header that stays put, a body that scrolls, and an
// optional footer pinned to the bottom.
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
      <div className="screen">
        <HeaderBar title={title} buttons={buttons} subhead={subhead} />
        <div ref={ref} className="screen-body">
          {children}
        </div>
        {footer && <div className="screen-footer">{footer}</div>}
      </div>
    </ThemeContext>
  );
}
