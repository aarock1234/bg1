// ==UserScript==
// @name         BG1 Autoloader
// @namespace    https://bg1-production.up.railway.app/bg1/
// @version      0.5
// @description  Automatically loads the BG1 interface
// @author       aarock1234
// @match        https://joelface.github.io/bg1/start.html
// @match        https://disneyworld.disney.go.com/vas/
// @match        https://disneyworld.disney.go.com/*/vas/
// @match        https://disneyland.disney.go.com/vas/
// @match        https://disneyland.disney.go.com/*/vas/
// @match        https://vqguest-svc-wdw.wdprapps.disney.com/application/v1/guest/getQueues
// @match        https://vqguest-svc.wdprapps.disney.com/application/v1/guest/getQueues
// @grant        none
// ==/UserScript==
'use strict';

// Where the built app (bg1.js and bg1.css) is hosted.
const APP_URL = 'https://bg1-production.up.railway.app/bg1/';

// The start page that links to the Disney pages BG1 takes over.
const START_PAGE_URL = 'https://joelface.github.io/bg1/start.html';

function replacePageWithApp() {
  document.open();
  document.write(
    `<!doctype html><link rel=stylesheet href="${APP_URL}bg1.css"><body>`
  );

  const script = document.createElement('script');
  script.type = 'module';
  script.src = `${APP_URL}bg1.js`;
  document.head.appendChild(script);
}

if (window.location.href === START_PAGE_URL) {
  document.body.classList.add('autoload');
} else {
  replacePageWithApp();
}
