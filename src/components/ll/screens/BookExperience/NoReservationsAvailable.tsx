import PartyList from './PartyList';

export default function NoReservationsAvailable() {
  return (
    <>
      <div className="card mt-5">
        <h3 className="mt-0">No Reservations Available</h3>
        <p className="note mb-0">
          There aren't enough reservation slots available for your entire party.
          If only part of your group wishes to go on this attraction, edit your
          party to check again. Otherwise, go back to the attraction list and
          select another attraction.
        </p>
      </div>
      <PartyList />
    </>
  );
}
