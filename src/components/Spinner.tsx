import Overlay from './Overlay';

// Covers the screen while something loads, so nothing can be tapped until it
// has finished.
export default function Spinner() {
  return (
    <Overlay color="bg-canvas/50">
      <div
        role="alert"
        aria-label="Loading…"
        className="grid size-14 place-items-center rounded-card border border-line bg-surface"
      >
        <div className="spinner" />
      </div>
    </Overlay>
  );
}
