import Button from '@/components/Button';
import RefreshIcon from '@/icons/RefreshIcon';

type RefreshButtonProps = Omit<
  React.HTMLProps<HTMLButtonElement>,
  'type' | 'onClick'
> & {
  // What the button refreshes, such as "Plans".
  name: string;
  onClick: () => void;
};

export default function RefreshButton({
  name,
  onClick,
  ...props
}: RefreshButtonProps) {
  return (
    <Button {...props} title={`Refresh ${name}`} onClick={onClick}>
      <RefreshIcon />
    </Button>
  );
}
