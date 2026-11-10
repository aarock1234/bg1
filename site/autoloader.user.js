// ==UserScript==
// @name         BG1 Autoloader
// @namespace    https://bg1.abdels.dev/
// @version      0.6
// @description  Automatically loads the BG1 interface
// @author       aarock1234
// @match        https://bg1.abdels.dev/
// @match        https://disneyworld.disney.go.com/vas/
// @match        https://disneyworld.disney.go.com/*/vas/
// @match        https://disneyland.disney.go.com/vas/
// @match        https://disneyland.disney.go.com/*/vas/
// @match        https://vqguest-svc-wdw.wdprapps.disney.com/application/v1/guest/getQueues
// @match        https://vqguest-svc.wdprapps.disney.com/application/v1/guest/getQueues
// @downloadURL  https://bg1.abdels.dev/autoloader.user.js
// @updateURL    https://bg1.abdels.dev/autoloader.user.js
// @grant        none
// ==/UserScript==
'use strict';

// BG1's own site: its home page, and the built app under /bg1/.
const HOME_URL = 'https://bg1.abdels.dev/';
const APP_URL = `${HOME_URL}bg1/`;

// Lets the home page show that the script is installed and working.
function markInstalled() {
  document.documentElement.classList.add('bg1-installed');
}

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

if (window.location.href === HOME_URL) {
  markInstalled();
} else {
  replacePageWithApp();
}
