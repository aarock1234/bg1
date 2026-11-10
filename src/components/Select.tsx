import MenuButton, { MenuButtonProps, MenuProps } from './MenuButton';

// Shared by every select menu. Only one menu is open at a time, so the radio
// groups never overlap.
const RADIO_GROUP_NAME = '_SELECT_RADIO_BUTTON_';

type SelectProps<K extends string, V> = Omit<MenuButtonProps<K, V>, 'menuType'>;

export default function Select<K extends string, V = K>(
  props: SelectProps<K, V>
) {
  return <MenuButton {...props} menuType={SelectMenu} />;
}

export function SelectMenu<K extends string, V = K>(props: MenuProps<K, V>) {
  const { options, selected } = props;

  return (
    <ul className="dividers overflow-auto">
      {[...options].map(([key, option]) => (
        <li key={option.text}>
          <label className="flex items-center gap-x-2.5 px-4">
            <input
              type="radio"
              name={RADIO_GROUP_NAME}
              value={key}
              defaultChecked={key === selected}
              className="w-4 h-4 shrink-0"
            />{' '}
            {option.icon && <span aria-hidden="true">{option.icon}</span>}{' '}
            {option.text}
          </label>
        </li>
      ))}
    </ul>
  );
}
