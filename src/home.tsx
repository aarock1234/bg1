import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import ServerCheck from './components/home/ServerCheck';

// The element on BG1's home page (site/index.html) that this script fills in.
const ROOT_ID = 'server-check';

const rootElement = document.getElementById(ROOT_ID);

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ServerCheck />
    </StrictMode>
  );
}
