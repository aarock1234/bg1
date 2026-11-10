import { use, useRef, useState } from 'react';

import { authStore } from '@/api/auth';
import Overlay from '@/components/Overlay';
import NavContext from '@/contexts/NavContext';
import ExitIcon from '@/icons/ExitIcon';
import SettingsIcon from '@/icons/SettingsIcon';
import UserIcon from '@/icons/UserIcon';

import PartySelector from '../PartySelector';

// How long a chosen option waits to run, so the menu is gone before it does.
const ACTION_DELAY_MS = 50;

type MenuOption = {
  text: string;
  icon: React.ReactNode;
  action: () => void;
};

// The last item of Home's bottom navigation. It opens a menu instead of
// switching tabs.
export default function SettingsButton() {
  const { goTo } = use(NavContext);
  const [options] = useState<MenuOption[]>([
    {
      text: 'Party Selection',
      icon: <UserIcon className="w-5" />,
      action: () => goTo(<PartySelector />),
    },
    {
      text: 'Log Out',
      icon: <ExitIcon className="w-5" />,
      action: () => authStore.deleteData(),
    },
  ]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  function closeMenuOnOutsideClick(event: React.MouseEvent) {
    const isInsideMenu =
      event.target instanceof Node && listRef.current?.contains(event.target);

    if (!isInsideMenu) {
      setIsMenuOpen(false);
    }
  }

  function chooseOption(option: MenuOption) {
    setIsMenuOpen(false);
    setTimeout(option.action, ACTION_DELAY_MS);
  }

  return (
    <>
      <button
        className="tab"
        onClick={() => setIsMenuOpen(true)}
        title="Settings Menu"
        aria-label="Settings Menu"
      >
        <div>
          <SettingsIcon className="w-5.5" />
        </div>
        <div>Settings</div>
      </button>

      {isMenuOpen && (
        <Overlay
          position="bottom"
          onClick={closeMenuOnOutsideClick}
          data-testid="shade"
        >
          <ul className="sheet py-2" ref={listRef}>
            {options.map(option => (
              <li key={option.text}>
                <button
                  className="row px-4 font-medium"
                  onClick={() => chooseOption(option)}
                >
                  <span className="text-muted" aria-hidden>
                    {option.icon}
                  </span>
                  {option.text}
                </button>
              </li>
            ))}
          </ul>
        </Overlay>
      )}
    </>
  );
}
