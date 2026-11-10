import Icon, { IconProps } from './Icon';

// Path data from Lucide (https://lucide.dev), ISC license.
export default function DropIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Icon>
  );
}
