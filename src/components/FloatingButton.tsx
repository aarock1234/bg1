import Button from './Button';

type FloatingButtonProps = Parameters<typeof Button>[0];

// The screen's primary action: a full-width button in a bar fixed to the
// bottom of the screen. The spacer reserves room in the page so its content
// can scroll clear of the bar.
export default function FloatingButton(props: FloatingButtonProps) {
  return (
    <div className="action-bar-spacer">
      <div className="action-bar">
        <Button variant="primary" {...props} type="full" />
      </div>
    </div>
  );
}
