import { Queue } from '@/api/vq';
import Screen from '@/components/Screen';

type QueueScreenProps = {
  queue: Queue;
  title: string;
  children: React.ReactNode;
};

export default function QueueScreen({
  queue,
  title,
  children,
}: QueueScreenProps) {
  return (
    <Screen title={title} theme={queue.park?.theme}>
      <h2>{queue.name}</h2>
      {children}
    </Screen>
  );
}
