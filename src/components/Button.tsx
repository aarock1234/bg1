import { use } from 'react';

import NavContext, { NavError } from '@/contexts/NavContext';
import ThemeContext from '@/contexts/ThemeContext';

const TYPE_CLASSES = {
  normal: 'py-0.75',
  small: 'py-1.25 text-xs uppercase tracking-wide',
  full: 'w-full py-2.75',
};

const DEFAULT_BORDER = 'border border-black/20 rounded-lg';

// The screen to go back to. Without one, the button goes back one screen.
type BackTarget<P> = {
  screen?: React.FC<P>;
  props?: Partial<P>;
};

type ButtonProps<P> = Omit<
  React.HTMLProps<HTMLButtonElement>,
  'type' | 'onClick'
> & {
  onClick?: () => void | Promise<void>;
  type?: keyof typeof TYPE_CLASSES;
  back?: boolean | BackTarget<P>;
  color?: string;
  border?: string;
};

export default function Button<P>(props: ButtonProps<P>) {
  const {
    type = 'normal',
    back,
    onClick,
    className = '',
    color,
    border = DEFAULT_BORDER,
    ...attrs
  } = props;
  const { goBack } = use(NavContext);
  const theme = use(ThemeContext);
  const colorClasses = color ?? `${theme.bg} text-white`;

  // A back button still runs its click handler when there is no screen to go
  // back to.
  async function goBackIfPossible(target: BackTarget<P> | undefined) {
    try {
      await goBack(target);
    } catch (error) {
      if (!(error instanceof NavError)) {
        throw error;
      }
    }
  }

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (back) {
      await goBackIfPossible(back === true ? undefined : back);
    }

    await onClick?.();
  }

  return (
    <button
      onClick={handleClick}
      className={`${TYPE_CLASSES[type]} ${className} ${colorClasses} ${border} inline-flex items-center justify-center min-w-9 px-1.75 font-semibold disabled:opacity-50`}
      {...attrs}
    />
  );
}
