import FloatingButton from '@/components/FloatingButton';
import UserIcon from '@/icons/UserIcon';

type NoGuestsFoundProps = {
  onRefresh: () => void;
};

// Shown when Disney answers with an empty party. That usually means the
// account has no park tickets linked to it, so this reads as something to
// check rather than as an error.
export default function NoGuestsFound({ onRefresh }: NoGuestsFoundProps) {
  return (
    <>
      <div className="card mt-5">
        <UserIcon className="w-6 text-muted" />
        <h3 className="mt-3">No Guests Found</h3>
        <p className="note">
          Disney didn't return any guests for this account. If you have park
          tickets, make sure they are linked to this Disney account in the
          official Disney app.
        </p>
        <p className="note mb-0">
          If they are already linked, this may be a temporary problem. Wait a
          few seconds and try again.
        </p>
      </div>
      <FloatingButton onClick={onRefresh}>Try Again</FloatingButton>
    </>
  );
}
