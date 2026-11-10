import AlertIcon from '@/icons/AlertIcon';
import InfoIcon from '@/icons/InfoIcon';

export type FlashType = 'alert' | 'error';

type FlashProps = {
  message: string;
  type: FlashType;
};

// A brief message floating above the bottom of the screen. An error has its
// own icon, in the accent color, so it isn't told apart by color alone.
export default function Flash({ message, type }: FlashProps) {
  if (!message) {
    return null;
  }

  return (
    <div role="alert" className="toast">
      {type === 'error' ? <AlertIcon className="text-danger" /> : <InfoIcon />}
      {message}
    </div>
  );
}
