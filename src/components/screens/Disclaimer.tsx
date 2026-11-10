import AlertIcon from '@/icons/AlertIcon';

import FloatingButton from '../FloatingButton';
import Screen from '../Screen';

type DisclaimerProps = {
  onAccept: () => void;
};

export default function Disclaimer({ onAccept }: DisclaimerProps) {
  return (
    <Screen title="Warning!">
      <div className="card mt-4">
        <AlertIcon className="w-6" />
        <p className="mb-0">
          Use at your own risk. BG1 is highly experimental, for demonstration
          purposes only, and provided &quot;as is&quot; without warranty of any
          kind. It is in no way endorsed by or associated with the Walt Disney
          Company and could stop working at any time for any reason. To ensure
          the intended experience, always use the official Disney app.
        </p>
      </div>
      <FloatingButton onClick={onAccept}>Accept</FloatingButton>
    </Screen>
  );
}
