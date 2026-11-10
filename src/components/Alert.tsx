import AlertIcon from '@/icons/AlertIcon';

type AlertProps = {
  children?: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
};

// A notice the guest shouldn't miss, set apart by its outline and warning
// icon rather than by color.
export default function Alert({ children, className = '', title }: AlertProps) {
  return (
    <div
      className={`mt-4 rounded-card border border-line-strong bg-surface ${className}`}
    >
      {title ? (
        <>
          <h3 className="mt-0 flex items-center gap-2.5 px-3.5 py-3 text-[15px]">
            <AlertIcon />
            <span>{title}</span>
          </h3>
          <div className="-mt-1 px-3.5 pb-1 text-sm text-muted *:first:mt-0 empty:hidden">
            {children}
          </div>
        </>
      ) : (
        <div className="px-3.5 py-1 text-sm">{children}</div>
      )}
    </div>
  );
}
