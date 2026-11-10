import useScreenState from '@/hooks/useScreenState';
import BackIcon from '@/icons/BackIcon';

import Button from './Button';

type HeaderBarProps = {
  title: React.ReactNode;

  // Actions at the right end of the bar. Buttons placed here are drawn
  // quietly, without a border or background.
  buttons?: React.ReactNode;

  // Content that stays in view below the title, such as a toolbar.
  subhead?: React.ReactNode;
};

export default function HeaderBar({ title, buttons, subhead }: HeaderBarProps) {
  const { isFirstScreen } = useScreenState();

  return (
    <header className="screen-header">
      <div className="screen-header-bar">
        {!isFirstScreen && (
          <Button
            back
            variant="quiet"
            className="-ml-3 px-2"
            aria-label="Go Back"
          >
            <BackIcon className="w-6" />
          </Button>
        )}
        <h1 className="screen-title">{title}</h1>
        <div className="screen-actions">{buttons}</div>
      </div>
      <div className="screen-subhead">{subhead}</div>
    </header>
  );
}
