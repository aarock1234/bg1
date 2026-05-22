import NavProvider from '@/providers/NavProvider';

import SelectQueue from './screens/SelectQueue';

export default function BGClient() {
  return (
    <NavProvider>
      <SelectQueue />
    </NavProvider>
  );
}
