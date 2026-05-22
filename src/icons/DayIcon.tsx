import Icon from './Icon';

/**
 * Modified calendar icon from [IcoMoon]{@link https://icomoon.io/#icons-icomoon}
 * @license CC-BY-4.0
 */
export default function DayIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M 0 0 L 0 16 L 15 16 L 15 0 L 13 0 L 13 1 L 11 1 L 11 0 L 4 0 L 4 1 L 2 1 L 2 0 L 0 0 z M 1 4 L 14 4 L 14 15 L 1 15 L 1 4 z" />
    </Icon>
  );
}
