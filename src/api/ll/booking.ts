import { requestStatus } from '../client';
import type { Guest, LLClient, LLMP, Offer } from '../ll';

type BookingClient = Pick<LLClient, 'book' | 'cancelBooking'>;

// Books an offer for the given guests only. Disney books everyone the offer
// was made for, so anyone who wasn't chosen is cancelled again afterward.
export async function bookForGuests(
  ll: BookingClient,
  offer: Offer,
  guests: Guest[]
): Promise<LLMP> {
  const booking = await ll.book(offer, guests);
  const chosenGuestIds = new Set(guests.map(guest => guest.id));
  const unchosenGuests = booking.guests.filter(guest => {
    return !chosenGuestIds.has(guest.id);
  });

  if (unchosenGuests.length === 0) {
    return booking;
  }

  try {
    await ll.cancelBooking(unchosenGuests);
  } catch (error) {
    // The booking itself succeeded, so it is returned with every guest it
    // still covers. Only the status is logged: this also runs on the server,
    // where Disney's answer has no place in the log.
    console.warn(
      'cancelling unchosen guests failed with status',
      requestStatus(error)
    );

    return booking;
  }

  return {
    ...booking,
    guests: booking.guests.filter(guest => chosenGuestIds.has(guest.id)),
  };
}
