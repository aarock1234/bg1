import useFlash from '@/hooks/useFlash';

const AVATAR_SIZE_PX = 48;

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
      <ul className="mt-4">
        {guests.map(guest => {
          const isSelected = selectedGuests.has(guest);
          const isDisabled = isLimitReached && !isSelected;

          return (
            <li
              key={guest.id}
              className="px-3 py-1"
              onClick={() => flash(isDisabled ? 'Selection limit reached' : '')}
            >
              <label className="flex items-center">
                {selectable && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => selectable.onToggle(guest)}
                    className="mr-3"
                  />
                )}
                <Avatar guest={guest} />
                <span className="leading-tight">
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

type AvatarProps = {
  guest: Guest;
};

// Shows the guest's picture, or their initial when they don't have one.
function Avatar({ guest }: AvatarProps) {
  return (
    <span className="w-12 h-12 leading-12 mr-3 rounded-full text-3xl font-bold text-center bg-gray-400 text-white">
      {guest.avatarImageUrl ? (
        <img
          src={guest.avatarImageUrl}
          alt=""
          width={AVATAR_SIZE_PX}
          height={AVATAR_SIZE_PX}
          className="rounded-full"
        />
      ) : (
        <span aria-hidden="true">{guest.name[0]}</span>
      )}
    </span>
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
    <span className="block text-xs font-semibold text-red-d uppercase">
      {reason.replaceAll('_', ' ')}
    </span>
  );
}
