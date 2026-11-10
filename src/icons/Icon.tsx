import { use } from 'react';

import ThemeContext from '@/contexts/ThemeContext';

const WIDTH_CLASS_PATTERN = /\bw-\S/;
const HEIGHT_CLASS_PATTERN = /\bh-\S/;

export type IconProps = {
  className?: string;
  themed?: boolean;
  title?: string;
};

type IconElementProps = IconProps & {
  children: React.ReactNode;
};

// Adds the default icon size to classes that don't set a width or a height.
function withDefaultSize(className: string): string {
  const widthClass = WIDTH_CLASS_PATTERN.test(className) ? '' : ' w-4';
  const heightClass = HEIGHT_CLASS_PATTERN.test(className) ? '' : ' h-auto';

  return `${className}${widthClass}${heightClass}`;
}

export default function Icon({
  children,
  className = '',
  themed,
  title,
}: IconElementProps) {
  const theme = use(ThemeContext);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={themed ? theme.color : 'currentColor'}
      viewBox="0 0 16 16"
      className={`mx-auto ${withDefaultSize(className)}`}
      role="img"
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
