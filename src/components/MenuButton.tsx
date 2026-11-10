import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import ChevronDownIcon from '@/icons/ChevronDownIcon';

import Button from './Button';
import Overlay from './Overlay';

const CONFIRM_KEYS = ['Enter', ' '];

export type Option<V> = {
  text: string;
  buttonText?: string;
  icon?: React.ReactNode;
  value?: V;
};

// A menu lists the options as radio inputs whose values are the option keys.
// MenuButton reads the checked input to learn which option was picked.
export type MenuProps<K, V> = {
  options: Map<K, Option<V>>;
  selected?: K;
  onChange: (value: V) => void;
};

export type MenuButtonProps<K, V> = Omit<
  Parameters<typeof Button>[0],
  'children' | 'selected' | 'onChange'
> &
  MenuProps<K, V> & {
    menuType: React.ComponentType<MenuProps<K, V>>;
  };

function findCheckedInput(menuContainer: HTMLElement | null) {
  return (
    menuContainer?.querySelector<HTMLInputElement>('input:checked') ?? null
  );
}

function isOutside(container: HTMLElement | null, target: EventTarget | null) {
  return target instanceof Node && !container?.contains(target);
}

export default function MenuButton<K, V>(props: MenuButtonProps<K, V>) {
  const {
    options,
    selected,
    title,
    onChange,
    disabled,
    menuType: Menu,
    ...buttonProps
  } = props;
  const [isMenuShown, setIsMenuShown] = useState(false);
  const [minTextWidth, setMinTextWidth] = useState(0);
  // Moving through the radio inputs with the arrow keys checks each one along
  // the way, which must not count as choosing it.
  const [arrowPressed, setArrowPressed] = useState(false);
  const buttonTextRef = useRef<HTMLSpanElement>(null);
  const menuContainerRef = useRef<HTMLFormElement>(null);

  // We don't want the button width to change every time a different option
  // is selected, so we have to find the largest width of all the options.
  useLayoutEffect(() => {
    const [firstOption] = options.values();

    if (firstOption?.icon) {
      return;
    }

    const textElem = buttonTextRef.current;
    const textNode = textElem?.firstChild;

    if (!textElem || !textNode) {
      return;
    }

    const currentText = textNode.nodeValue;

    if (!currentText) {
      return;
    }

    // The width set by the last measurement would hide the width of the text.
    const currentWidth = textElem.style.width;
    textElem.style.width = '';

    let widestTextWidth = 0;

    for (const option of options.values()) {
      textNode.nodeValue = option.buttonText ?? option.text;
      widestTextWidth = Math.max(textElem.offsetWidth, widestTextWidth);
    }

    textNode.nodeValue = currentText;
    textElem.style.width = currentWidth;
    setMinTextWidth(widestTextWidth);
  }, [options]);

  // Brings the selected option into view when the menu opens, and closes the
  // menu when focus moves outside of it.
  useEffect(() => {
    if (!isMenuShown) {
      return;
    }

    const checkedInput = findCheckedInput(menuContainerRef.current);
    checkedInput?.closest('li')?.scrollIntoView({
      block: 'center',
    });
    checkedInput?.focus();

    function closeOnOutsideFocus(event: FocusEvent) {
      if (isOutside(menuContainerRef.current, event.target)) {
        setIsMenuShown(false);
      }
    }

    addEventListener('focusin', closeOnOutsideFocus);

    return () => removeEventListener('focusin', closeOnOutsideFocus);
  }, [isMenuShown]);

  function changeValue() {
    const checkedInput = findCheckedInput(menuContainerRef.current);

    if (checkedInput) {
      // The input's value is the option's key, which is also the option's
      // value unless it specifies another one.
      const key = checkedInput.value as K;
      const option = options.get(key);

      if (option) {
        onChange(option.value ?? (key as unknown as V));
      }
    }

    setIsMenuShown(false);
  }

  function handleMenuChange() {
    if (!arrowPressed) {
      changeValue();
    }

    setArrowPressed(false);
  }

  function handleOverlayClick(event: React.MouseEvent) {
    if (arrowPressed) {
      return;
    }

    const menuContainer = menuContainerRef.current;

    if (isOutside(menuContainer, event.target)) {
      setIsMenuShown(false);
    } else if (event.target === findCheckedInput(menuContainer)) {
      setIsMenuShown(false);
      changeValue();
    }
  }

  function handleKeyDown({ key }: React.KeyboardEvent) {
    if (CONFIRM_KEYS.includes(key)) {
      changeValue();
    } else if (key.startsWith('Arrow')) {
      setArrowPressed(true);
    }
  }

  const buttonOption = findButtonOption(options, selected, title);

  if (!buttonOption) {
    return null;
  }

  const { icon, text, buttonText } = buttonOption;

  return (
    <>
      <Button
        {...buttonProps}
        title={title}
        aria-label={icon ? text : undefined}
        disabled={disabled ?? options.size === 0}
        onClick={() => setIsMenuShown(true)}
      >
        {icon ? (
          icon
        ) : (
          <span
            className="min-w-0 flex-auto truncate py-1 text-left"
            style={{
              width: minTextWidth > 0 ? `${minTextWidth}px` : undefined,
            }}
            ref={buttonTextRef}
          >
            {buttonText ?? text}
          </span>
        )}
        <ChevronDownIcon className="w-4 text-muted" />
      </Button>
      {isMenuShown && (
        <Overlay
          position="bottom"
          onChange={handleMenuChange}
          onClick={handleOverlayClick}
          onKeyDown={handleKeyDown}
          data-testid="shade"
        >
          <div className="sheet">
            {title && <h3 className="sheet-title">{title}</h3>}
            <form
              aria-label={`${title} Selection`}
              className="sheet-body"
              ref={menuContainerRef}
            >
              <Menu options={options} selected={selected} onChange={onChange} />
            </form>
          </div>
        </Overlay>
      )}
    </>
  );
}

// Returns the option the button shows: the selected one, or the title while
// nothing is selected.
function findButtonOption<K, V>(
  options: Map<K, Option<V>>,
  selected: K | undefined,
  title: string | undefined
): Option<V> | undefined {
  if (selected) {
    return options.get(selected);
  }

  if (title !== undefined) {
    return {
      text: title,
    };
  }

  return undefined;
}
