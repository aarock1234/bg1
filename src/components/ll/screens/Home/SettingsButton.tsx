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

export default function SettingsButton() {
  const { goTo } = use(NavContext);
  const [options] = useState<MenuOption[]>([
    {
      text: 'Party Selection',
      icon: <UserIcon />,
      action: () => goTo(<PartySelector />),
    },
    {
      text: 'Log Out',
      icon: <ExitIcon />,
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
        className="absolute top-0 right-0 h-full px-4"
        onClick={() => setIsMenuOpen(true)}
        title="Settings Menu"
      >
        <SettingsIcon />
      </button>

      {isMenuOpen && (
        <Overlay onClick={closeMenuOnOutsideClick} data-testid="shade">
          <ul
            className="dividers overflow-auto min-w-[50%] max-h-[90%] rounded-lg bg-white text-black text-lg font-normal"
            ref={listRef}
          >
            {options.map(option => (
              <li key={option.text}>
                <button
                  className="flex items-center w-full px-4"
                  onClick={() => chooseOption(option)}
                >
                  <span className="mr-2.5 text-gray-700" aria-hidden>
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
