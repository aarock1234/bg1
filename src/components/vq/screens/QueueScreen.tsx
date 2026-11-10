import { Queue } from '@/api/vq';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';

type QueueScreenProps = {
  queue: Queue;
  title: string;
  children: React.ReactNode;
};

// A screen about one queue: it opens with the queue's name and, when known,
// the park it is in.
export default function QueueScreen({
  queue,
  title,
  children,
}: QueueScreenProps) {
  return (
    <Screen title={title}>
      <h2 className="mt-5">{queue.name}</h2>
      {queue.park && <LandLine land={queue.park} />}
      {children}
    </Screen>
  );
}
