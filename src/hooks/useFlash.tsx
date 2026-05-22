import { useCallback, useEffect, useState } from 'react';

import Flash, { FlashType } from '@/components/Flash';

const DEFAULT_DURATION_MS = 3000;

export default function useFlash(): [React.ReactNode, typeof flash] {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<FlashType>('alert');

  useEffect(() => {
    if (message === '') return;
    const timeoutId = self.setTimeout(() => {
      setMessage('');
    }, DEFAULT_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [message]);

  const flash = useCallback((message: string, type?: FlashType) => {
    setMessage(message);
    setType(type || 'alert');
  }, []);
  const flashElem = message ? <Flash message={message} type={type} /> : null;
  return [flashElem, flash];
}
