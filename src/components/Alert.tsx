type AlertProps = {
  children?: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
};

export default function Alert({ children, className = '', title }: AlertProps) {
  return (
    <div
      className={`mt-4 border-2 rounded-sm border-yellow-400 bg-yellow-100 ${className}`}
    >
      {title ? (
        <>
          <h3 className="mt-0 px-2 py-1 bg-yellow-400 text-black text-sm font-semibold uppercase text-center">
            {title}
          </h3>
          <div className="px-2">{children}</div>
        </>
      ) : (
        <div className="px-2 py-1">{children}</div>
      )}
    </div>
  );
}
