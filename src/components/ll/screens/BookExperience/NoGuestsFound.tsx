import FloatingButton from '@/components/FloatingButton';

type NoGuestsFoundProps = {
  onRefresh: () => void;
};

export default function NoGuestsFound({ onRefresh }: NoGuestsFoundProps) {
  return (
    <>
      <h3>No Guests Found</h3>
      <p>
        Your party could not be loaded. This is probably just a temporary
        network error. Wait a few seconds and try again.
      </p>
      <FloatingButton onClick={onRefresh}>Try Again</FloatingButton>
    </>
  );
}
