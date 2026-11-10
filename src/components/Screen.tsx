import HeaderBar from './HeaderBar';

export type ScreenProps = {
  title: React.ReactNode;
  children: React.ReactNode;
  buttons?: React.ReactNode;
  subhead?: React.ReactNode;
  footer?: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
};

// A full-screen page: a header that stays put, a body that scrolls, and an
// optional footer pinned to the bottom.
export default function Screen({
  title,
  buttons,
  subhead,
  footer,
  children,
  ref,
}: ScreenProps) {
  return (
    <div className="screen">
      <HeaderBar title={title} buttons={buttons} subhead={subhead} />
      <div ref={ref} className="screen-body">
        {children}
      </div>
      {footer && <div className="screen-footer">{footer}</div>}
    </div>
  );
}
