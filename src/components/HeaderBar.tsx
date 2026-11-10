import { Children, Fragment, isValidElement, use } from 'react';

import ThemeContext, { Theme } from '@/contexts/ThemeContext';
import useScreenState from '@/hooks/useScreenState';
import BackIcon from '@/icons/BackIcon';

import Button from './Button';

// The props of a header button that the header bar overrides.
type HeaderButtonProps = {
  children?: React.ReactNode;
  className?: string;
  color?: string;
};

// Restyles the buttons passed to the header so they stand out against its
// themed background. Buttons may be wrapped in fragments; plain HTML elements
// and text are left alone.
function withHeaderColors(
  node: React.ReactNode,
  theme: Theme
): React.ReactNode {
  if (!isValidElement<HeaderButtonProps>(node)) {
    return node;
  }

  if (typeof node.type === 'string') {
    return node;
  }

  if (node.type === Fragment) {
    return Children.map(node.props.children, child => {
      return withHeaderColors(child, theme);
    });
  }

  const HeaderButton = node.type;

  return (
    <HeaderButton
      {...node.props}
      color={`bg-white/90 ${theme.text}`}
      className={`min-h-9 ${node.props.className ?? ''}`}
    />
  );
}

type HeaderBarProps = {
  title: React.ReactNode;
  buttons?: React.ReactNode;
  subhead?: React.ReactNode;
};

export default function HeaderBar({ title, buttons, subhead }: HeaderBarProps) {
  const { isFirstScreen } = useScreenState();
  const theme = use(ThemeContext);

  return (
    <header className={`px-3 ext-lg text-white ${theme.bg}`}>
      <div className="flex flex-wrap justify-end gap-x-2 gap-y-1 min-h-9 py-2">
        {!isFirstScreen && (
          <Button back border="" className="-my-2 -ml-3" aria-label="Go Back">
            <BackIcon />
          </Button>
        )}
        <h1 className="flex-1 self-center py-1 text-xl font-semibold overflow-hidden whitespace-nowrap">
          {title}
        </h1>
        {withHeaderColors(buttons, theme)}
      </div>
      <div
        className={`empty:hidden flex flex-col gap-y-1 pb-1 ${theme.bg} text-white text-sm font-semibold uppercase text-center`}
      >
        {subhead}
      </div>
    </header>
  );
}
