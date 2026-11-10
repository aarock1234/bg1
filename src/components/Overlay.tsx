const POSITION_CLASSES = {
  center: 'overlay-center',
  bottom: 'overlay-bottom',
};

type OverlayProps = React.HTMLProps<HTMLDivElement> & {
  // The backdrop's background class. Defaults to a dark scrim.
  color?: string;

  // Where the content sits: in the middle, or against the bottom edge for a
  // sheet.
  position?: keyof typeof POSITION_CLASSES;
};

// A layer that covers the screen and holds whatever is shown above it.
export default function Overlay(props: OverlayProps) {
  const {
    children,
    color = '',
    position = 'center',
    className = '',
    ...attrs
  } = props;

  return (
    <div
      className={`overlay ${POSITION_CLASSES[position]} ${color} ${className}`}
      {...attrs}
    >
      {children}
    </div>
  );
}
