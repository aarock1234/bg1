import {
  FC,
  JSX,
  ReactElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import NavContext, { NavError, NavMethods } from '@/contexts/NavContext';
import ScreensContext, { Screens } from '@/contexts/ScreensContext';

// A screen in the navigation stack. The key keeps the screen's state when the
// screens around it change.
type StackItem = {
  elem: JSX.Element;
  key: number;
};

let lastKey = 0;

function nextKey(): number {
  lastKey += 1;

  return lastKey;
}

// The position in the stack of the screen the browser is showing. It lives in
// the URL hash, which makes the browser's back button work.
function getHashPos(): number {
  return Number(location.hash.slice(1)) || 0;
}

function isScreen<P>(elem: unknown, Screen: FC<P>): elem is ReactElement<P> {
  return isValidElement(elem) && elem.type === Screen;
}

function preventUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
}

type NavProviderProps = {
  children: JSX.Element;
};

export default function NavProvider({ children }: NavProviderProps) {
  const [screens, setScreens] = useState<Screens>({
    activeScreen: children,
  });
  const [stack, setStack] = useState<StackItem[]>([
    {
      elem: children,
      key: 0,
    },
  ]);

  // The ref always holds the latest stack, so that navigating more than once
  // before the next render builds on the previous step. The state renders it.
  const stackRef = useRef(stack);
  const resolveGoBack = useRef<() => void>(undefined);

  const updateStack = useCallback((newStack: StackItem[]) => {
    stackRef.current = newStack;
    setStack(newStack);
  }, []);

  const goTo = useCallback<NavMethods['goTo']>(
    (elem, options) => {
      let pos = getHashPos();
      let key: number;
      let newStack: StackItem[];

      if (options?.replace) {
        newStack = [...stackRef.current];
        key = newStack[pos]?.key ?? nextKey();
      } else {
        pos += 1;
        newStack = stackRef.current.slice(0, pos);
        key = nextKey();
        location.hash = `#${pos}`;
      }

      newStack[pos] = {
        elem,
        key,
      };

      updateStack(newStack);
      setScreens({
        activeScreen: elem,
        prevScreen: newStack[pos - 1]?.elem,
      });
    },
    [updateStack]
  );

  const goBack = useCallback<NavMethods['goBack']>(
    ({ screen: Screen, props } = {}) => {
      // Going back is done by the browser, which reports it with a hashchange
      // event some time later.
      const hashChanged = new Promise<void>(resolve => {
        resolveGoBack.current = resolve;
      });

      if (!Screen) {
        history.back();

        return hashChanged;
      }

      const currentPos = getHashPos();

      for (let pos = currentPos - 1; pos >= 0; --pos) {
        const item = stackRef.current[pos];

        if (!item || !isScreen(item.elem, Screen)) {
          continue;
        }

        history.go(pos - currentPos);

        if (props) {
          const newStack = [...stackRef.current];

          newStack[pos] = {
            elem: <Screen {...item.elem.props} {...props} />,
            key: item.key,
          };
          updateStack(newStack);
        }

        return hashChanged;
      }

      throw new NavError(`No previous ${Screen.name} screen`);
    },
    [updateStack]
  );

  const nav = useMemo<NavMethods>(() => {
    return {
      goTo,
      goBack,
    };
  }, [goTo, goBack]);

  useEffect(() => {
    function showScreenAtHashPos() {
      resolveGoBack.current?.();
      resolveGoBack.current = undefined;

      const pos = getHashPos();
      const isPastEndOfStack = pos >= stackRef.current.length;

      if (isPastEndOfStack) {
        history.back();
        return;
      }

      setScreens({
        activeScreen: stackRef.current[pos]?.elem ?? <div />,
        prevScreen: stackRef.current[pos - 1]?.elem,
      });
    }

    location.replace('#0');
    addEventListener('hashchange', showScreenAtHashPos);
    addEventListener('beforeunload', preventUnload);

    return () => {
      removeEventListener('hashchange', showScreenAtHashPos);
      removeEventListener('beforeunload', preventUnload);
    };
  }, []);

  const activePos = Math.min(getHashPos(), stack.length - 1);
  const reachableStack = stack.slice(0, activePos + 1);

  return (
    <NavContext value={nav}>
      <ScreensContext value={screens}>
        {reachableStack.map(({ elem, key }, pos) => (
          <article key={key} hidden={pos !== activePos}>
            {elem}
          </article>
        ))}
      </ScreensContext>
    </NavContext>
  );
}
