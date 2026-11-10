import { ReactNode, useCallback, useEffect, useState } from 'react';

import Flash, { FlashType } from '@/components/Flash';

const FLASH_DURATION_MS = 3000;

// Shows a message, replacing the current one. An empty message hides it.
export type ShowFlash = (message: string, type?: FlashType) => void;

type FlashState = {
  message: string;
  type: FlashType;
};

const NO_FLASH: FlashState = {
  message: '',
  type: 'alert',
};

// Provides a brief message banner: the element to render and a function that
// shows a message in it for a few seconds.
export default function useFlash(): [ReactNode, ShowFlash] {
  const [flashState, setFlashState] = useState(NO_FLASH);
  const { message, type } = flashState;

  // Depending on the whole state restarts the timer when the same message is
  // shown again.
  useEffect(() => {
    if (flashState.message === '') {
      return;
    }

    const timeoutId = setTimeout(() => {
      setFlashState(NO_FLASH);
    }, FLASH_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [flashState]);

  const flash = useCallback<ShowFlash>((message, type = 'alert') => {
    setFlashState({
      message,
      type,
    });
  }, []);

  const flashElem = message ? <Flash message={message} type={type} /> : null;

  return [flashElem, flash];
}
