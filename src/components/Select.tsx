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

// Lists the options as rows. The radio button of the selected row shows as a
// checkmark at its right end.
export function SelectMenu<K extends string, V = K>(props: MenuProps<K, V>) {
  const { options, selected } = props;

  return (
    <ul className="pb-2">
      {[...options].map(([key, option]) => (
        <li key={option.text}>
          <label className="row px-4 has-checked:font-medium">
            <input
              type="radio"
              name={RADIO_GROUP_NAME}
              value={key}
              defaultChecked={key === selected}
              className="menu-check order-last ml-auto"
            />{' '}
            {option.icon && <span aria-hidden="true">{option.icon}</span>}{' '}
            {option.text}
          </label>
        </li>
      ))}
    </ul>
  );
}
