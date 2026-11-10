import Button from './Button';

type TryAgainProps = {
  // What couldn't be done, such as "BG1 Couldn't Start".
  title: string;

  onRetry: () => void;
};

// Shown when something BG1 needs before it can do anything didn't load,
// which on a phone in a park usually means the connection dropped.
export default function TryAgain({ title, onRetry }: TryAgainProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3">
      <h3 className="my-0">{title}</h3>
      <p className="note my-0 max-w-64">Check your connection and try again.</p>
      <Button variant="primary" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  );
}
