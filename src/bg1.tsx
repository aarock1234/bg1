import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';

import App from './components/App';

// How long to wait before checking again whether the page has a body.
const BODY_CHECK_INTERVAL_MS = 100;

const DOCUMENT_TITLE = 'BG1';
const DOCUMENT_LANGUAGE = 'en-US';

// The app's background color (--color-canvas in bg1.css), which the browser
// also uses for its own bars around the page.
const CANVAS_COLOR = '#0a0a0a';

// `viewport-fit=cover` lets the app draw under the notch and the home
// indicator, where bg1.css pads it with the safe-area insets.
// `maximum-scale=1` keeps the page from zooming when a control is focused.
const VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';

main();

function main() {
  if (!document.body) {
    setTimeout(main, BODY_CHECK_INTERVAL_MS);
    return;
  }

  document.close();
  setUpDocument();

  createAppRoot().render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// The userscript that loads BG1 leaves a document with nothing but the
// stylesheet link, so everything else a page needs is added here.
function setUpDocument() {
  document.documentElement.lang = DOCUMENT_LANGUAGE;
  document.title = DOCUMENT_TITLE;

  addMeta('viewport', VIEWPORT);
  addMeta('theme-color', CANVAS_COLOR);
  addMeta('color-scheme', 'dark');
  addMeta('format-detection', 'telephone=no');
  addBlankFavicon();
}

function addMeta(name: string, content: string) {
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
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
