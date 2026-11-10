import Icon, { IconProps } from './Icon';

// Path data from Lucide (https://lucide.dev), ISC license.
export default function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icon>
  );
}
