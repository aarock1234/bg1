const AVATAR_SIZE_PX = 36;

type AvatarGuest = {
  name: string;
  avatarImageUrl?: string;
};

type AvatarProps = {
  guest: AvatarGuest;
};

// Shows the guest's picture, or their initial when they don't have one.
export default function Avatar({ guest }: AvatarProps) {
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-pressed text-sm font-semibold text-ink">
      {guest.avatarImageUrl ? (
        <img
          src={guest.avatarImageUrl}
          alt=""
          width={AVATAR_SIZE_PX}
          height={AVATAR_SIZE_PX}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{guest.name[0]}</span>
      )}
    </span>
  );
}
