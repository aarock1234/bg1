import useFlash from '@/hooks/useFlash';

import Avatar from './Avatar';

export type Guest = {
  id: string;
  name: string;
  avatarImageUrl?: string;
};

export type InfoById = Record<string, string | undefined>;

type Selectable<T extends Guest> = {
  isSelected: (guest: T) => boolean;
  onToggle: (guest: T) => void;
  limit?: number;
};

type GuestListProps<T extends Guest> = {
  guests: T[];
  selectable?: Selectable<T>;
  conflicts?: InfoById;
};

// A grouped list of guests. A selectable list has a checkbox on each row, and
// the whole row toggles it.
export default function GuestList<T extends Guest>({
  guests,
  selectable,
  conflicts,
}: GuestListProps<T>) {
  const [flashElem, flash] = useFlash();

  if (guests.length === 0) {
    return null;
  }

  const selectedGuests = new Set(
    selectable ? guests.filter(selectable.isSelected) : []
  );
  const isLimitReached = selectedGuests.size >= (selectable?.limit ?? Infinity);

  return (
    <>
      <ul className="list mt-3">
        {guests.map(guest => {
          const isSelected = selectedGuests.has(guest);
          const isDisabled = isLimitReached && !isSelected;

          return (
            <li
              key={guest.id}
              onClick={() => flash(isDisabled ? 'Selection limit reached' : '')}
            >
              <label className="row">
                {selectable && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => selectable.onToggle(guest)}
                  />
                )}
                <Avatar guest={guest} />
                <span
                  className={`row-title leading-tight ${isDisabled ? 'text-muted' : ''}`}
                >
                  {guest.name}
                  <Conflict reason={conflicts?.[guest.id]} />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {flashElem}
    </>
  );
}

type ConflictProps = {
  reason: string | undefined;
};

// Shows a conflict code such as NOT_IN_PARK as readable text.
function Conflict({ reason }: ConflictProps) {
  if (!reason) {
    return null;
  }

  return (
    <span className="mt-1 block text-[11px] font-medium tracking-wide text-danger uppercase">
      {reason.replaceAll('_', ' ')}
    </span>
  );
}
