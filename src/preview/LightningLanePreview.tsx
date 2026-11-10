import { use, useCallback } from 'react';

import Merlock from '@/components/ll/Merlock';
import Home from '@/components/ll/screens/Home';
import ClientsContext from '@/contexts/ClientsContext';
import BookingDateProvider from '@/providers/BookingDateProvider';
import DasPartiesProvider from '@/providers/DasPartiesProvider';
import ExperiencesProvider from '@/providers/ExperiencesProvider';
import NavProvider from '@/providers/NavProvider';
import ParkProvider from '@/providers/ParkProvider';
import PlansProvider from '@/providers/PlansProvider';
import RebookingProvider from '@/providers/RebookingProvider';

import DeepLink from './DeepLink';
import { PreviewWorld } from './clients';
import { LL_SCREENS } from './ll-screens';
import { PreviewOptions } from './options';
import { findPark } from './resort';

type LightningLanePreviewProps = {
  world: PreviewWorld;
  options: PreviewOptions;
};

// Shows the Lightning Lane app. Without a screen to open it is exactly what
// the real app mounts. With one, the same providers are set up here so the
// screen can be opened on top of Home.
export default function LightningLanePreview({
  world,
  options,
}: LightningLanePreviewProps) {
  const clients = use(ClientsContext);
  const { screen, id, park: parkName } = options;
  const openScreen = screen ? LL_SCREENS[screen] : undefined;

  const open = useCallback(async () => {
    if (!openScreen) {
      throw new Error('no screen to open');
    }

    return openScreen({
      world,
      clients,
      park: findPark(world.previewResort.resort, parkName),
      id,
    });
  }, [openScreen, world, clients, parkName, id]);

  if (!openScreen) {
    return <Merlock />;
  }

  return (
    <DasPartiesProvider>
      <PlansProvider>
        <BookingDateProvider>
          <ParkProvider>
            <ExperiencesProvider>
              <RebookingProvider>
                <NavProvider>
                  <DeepLink open={open}>
                    <Home tabName={Home.getSavedTabName()} />
                  </DeepLink>
                </NavProvider>
              </RebookingProvider>
            </ExperiencesProvider>
          </ParkProvider>
        </BookingDateProvider>
      </PlansProvider>
    </DasPartiesProvider>
  );
}
