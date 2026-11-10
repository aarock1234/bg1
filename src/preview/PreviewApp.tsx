import LoginForm from '@/components/LoginForm';
import Disclaimer from '@/components/screens/Disclaimer';
import News from '@/components/screens/News';
import { Clients } from '@/contexts/ClientsContext';
import ClientsContext from '@/contexts/ClientsContext';
import ResortContext from '@/contexts/ResortContext';

import Kit from './Kit';
import LightningLanePreview from './LightningLanePreview';
import PreviewIndex from './PreviewIndex';
import VirtualQueuePreview from './VirtualQueuePreview';
import { PreviewWorld } from './clients';
import { PreviewOptions } from './options';

type PreviewAppProps = {
  world: PreviewWorld;
  clients: Clients;
  options: PreviewOptions;
};

function showIndex() {
  location.search = '';
}

function PreviewContent({ world, options }: Omit<PreviewAppProps, 'clients'>) {
  switch (options.app) {
    case 'll':
      return <LightningLanePreview world={world} options={options} />;
    case 'vq':
      return <VirtualQueuePreview options={options} />;
    case 'kit':
      return <Kit />;
    case 'login':
      return (
        <LoginForm resort={world.previewResort.resort} onLogin={showIndex} />
      );
    case 'disclaimer':
      return <Disclaimer onAccept={showIndex} />;
    case 'news':
      return <News />;
    default:
      return <PreviewIndex />;
  }
}

// Renders what the options ask for, inside the contexts that the real App
// component provides once a guest is logged in.
export default function PreviewApp({
  world,
  clients,
  options,
}: PreviewAppProps) {
  return (
    <ResortContext value={world.previewResort.resort}>
      <ClientsContext value={clients}>
        <PreviewContent world={world} options={options} />
      </ClientsContext>
    </ResortContext>
  );
}
