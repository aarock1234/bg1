import { use } from 'react';

import { Guest } from '@/api/ll';
import GuestList from '@/components/GuestList';
import PartyContext from '@/contexts/PartyContext';
import { formatTime } from '@/datetime';

// Shown for a guest who is listed as ineligible without a stated reason.
const NO_REASON_TEXT = 'ELIGIBLE FOR NEW BOOKING';

function ineligibilityText(guest: Guest): string {
  if (guest.eligibleAfter) {
    return `TOO EARLY (${formatTime(guest.eligibleAfter)})`;
  }

  return guest.ineligibleReason || NO_REASON_TEXT;
}

export default function IneligibleGuestList() {
  const { ineligible } = use(PartyContext);

  const reasonsByGuestId = Object.fromEntries(
    ineligible.map(guest => [guest.id, ineligibilityText(guest)])
  );

  return <GuestList guests={ineligible} conflicts={reasonsByGuestId} />;
}
