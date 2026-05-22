export type FlashType = 'alert' | 'error';

const COLORS = { alert: 'bg-yellow-200', error: 'bg-red-200' };

export default function Flash({
  message,
  type,
}: {
  message: string;
  type: FlashType;
}) {
  return message ? (
    <div
      role="alert"
      className={`fixed bottom-20 left-0 w-full p-2 font-semibold text-center ${COLORS[type]} text-gray-800`}
    >
      {message}
    </div>
  ) : null;
}
