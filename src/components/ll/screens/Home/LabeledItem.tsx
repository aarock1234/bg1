type LabeledItemProps = {
  label: React.ReactNode;
  children: React.ReactNode;
};

// A value with a quiet caption in front of it, such as "Standby 45 min".
export default function LabeledItem({ label, children }: LabeledItemProps) {
  return (
    <div className="flex items-center whitespace-nowrap">
      <span className="mr-2 text-[13px] font-medium text-muted">{label}</span>{' '}
      <span>{children}</span>
    </div>
  );
}
