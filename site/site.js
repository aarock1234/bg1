'use strict';

const tabs = [...document.querySelectorAll('[role="tab"]')];

function detectPlatform() {
  const userAgent = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return 'iphone';
  }

  if (/Android/.test(userAgent)) {
    return 'android';
  }

  return 'computer';
}

// Shows the setup steps for one platform and marks its tab as selected.
function showPlatform(platform) {
  for (const tab of tabs) {
    const isSelected = tab.dataset.platform === platform;
    const panel = document.getElementById(tab.getAttribute('aria-controls'));

    tab.setAttribute('aria-selected', String(isSelected));
    panel.hidden = !isSelected;
  }
}

for (const tab of tabs) {
  tab.addEventListener('click', () => showPlatform(tab.dataset.platform));
}

showPlatform(detectPlatform());
