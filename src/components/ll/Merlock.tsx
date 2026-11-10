import { useState } from 'react';

import BookingDateProvider from '@/providers/BookingDateProvider';
import DasPartiesProvider from '@/providers/DasPartiesProvider';
import ExperiencesProvider from '@/providers/ExperiencesProvider';
import NavProvider from '@/providers/NavProvider';
import ParkProvider from '@/providers/ParkProvider';
import PlansProvider from '@/providers/PlansProvider';
import RebookingProvider from '@/providers/RebookingProvider';

import Home from './screens/Home';

// The Lightning Lane client: the Home screen and the state shared by every
// screen reached from it.
export default function Merlock() {
  const [tabName] = useState(Home.getSavedTabName);

  return (
    <DasPartiesProvider>
      <PlansProvider>
        <BookingDateProvider>
          <ParkProvider>
            <ExperiencesProvider>
              <RebookingProvider>
                <NavProvider>
                  <Home tabName={tabName} />
                </NavProvider>
              </RebookingProvider>
            </ExperiencesProvider>
          </ParkProvider>
        </BookingDateProvider>
      </PlansProvider>
    </DasPartiesProvider>
  );
}
