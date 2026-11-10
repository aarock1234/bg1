import Icon, { IconProps } from './Icon';

// Path data from Lucide (https://lucide.dev), ISC license.
export default function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  );
}
