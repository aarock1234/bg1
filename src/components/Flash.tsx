export type FlashType = 'alert' | 'error';

const COLORS = {
  alert: 'bg-yellow-200',
  error: 'bg-red-200',
};

type FlashProps = {
  message: string;
  type: FlashType;
};

export default function Flash({ message, type }: FlashProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`fixed bottom-20 left-0 w-full p-2 font-semibold text-center ${COLORS[type]} text-gray-800`}
    >
      {message}
    </div>
  );
}
