import { use } from 'react';

import NavContext, { NavError } from '@/contexts/NavContext';

const SIZE_CLASSES = {
  normal: '',
  small: 'btn-sm',
  full: 'btn-full',
};

const VARIANT_CLASSES = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
};

export type ButtonVariant = keyof typeof VARIANT_CLASSES;

// The screen to go back to. Without one, the button goes back one screen.
type BackTarget<P> = {
  screen?: React.FC<P>;
  props?: Partial<P>;
};

// Buttons used to take their colors and border from the caller. They are
// monochrome now, so these props are accepted and ignored.
type LegacyStyleProps = {
  color?: string;
  border?: string;
};

type ButtonProps<P> = Omit<
  React.HTMLProps<HTMLButtonElement>,
  'type' | 'onClick'
> &
  LegacyStyleProps & {
    onClick?: () => void | Promise<void>;

    // The button's size.
    type?: keyof typeof SIZE_CLASSES;

    // How much the button stands out. A screen has one primary button at most.
    variant?: ButtonVariant;

    back?: boolean | BackTarget<P>;
  };

function withoutLegacyStyleProps<T extends LegacyStyleProps>(
  props: T
): Omit<T, keyof LegacyStyleProps> {
  const remainingProps = {
    ...props,
  };

  delete remainingProps.color;
  delete remainingProps.border;

  return remainingProps;
}

export default function Button<P>(props: ButtonProps<P>) {
  const {
    type = 'normal',
    variant = 'secondary',
    back,
    onClick,
    className = '',
    ...attrs
  } = withoutLegacyStyleProps(props);
  const { goBack } = use(NavContext);

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
      className={`btn ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[type]} ${className}`}
      {...attrs}
    />
  );
}
