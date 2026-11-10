const WIDTH_CLASS_PATTERN = /\b(w|size)-\S/;
const HEIGHT_CLASS_PATTERN = /\b(h|size)-\S/;

export type IconProps = {
  className?: string;

  // Fills the shape in, as the "on" state of an icon that toggles.
  filled?: boolean;

  title?: string;
};

type IconElementProps = IconProps & {
  children: React.ReactNode;
};

// Adds the default icon size to classes that don't set a width or a height.
function withDefaultSize(className: string): string {
  const widthClass = WIDTH_CLASS_PATTERN.test(className) ? '' : ' w-4.5';
  const heightClass = HEIGHT_CLASS_PATTERN.test(className) ? '' : ' h-auto';

  return `${className}${widthClass}${heightClass}`;
}

// An outline icon on a 24×24 grid, drawn in the color of the text around it.
export default function Icon({
  children,
  className = '',
  filled,
  title,
}: IconElementProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${withDefaultSize(className)}`}
      role="img"
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
