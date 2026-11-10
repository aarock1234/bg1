import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';

import App from './components/App';

// How long to wait before checking again whether the page has a body.
const BODY_CHECK_INTERVAL_MS = 100;

main();

function main() {
  if (!document.body) {
    setTimeout(main, BODY_CHECK_INTERVAL_MS);
    return;
  }

  document.close();
  addViewportMeta();
  addBlankFavicon();

  createAppRoot().render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

function addViewportMeta() {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
  document.head.append(meta);
}

// Keeps the browser from requesting the host site's favicon.
function addBlankFavicon() {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = 'data:,';
  document.head.append(link);
}

function createAppRoot(): Root {
  const container = document.createElement('div');
  document.body.append(container);

  return createRoot(container);
}
