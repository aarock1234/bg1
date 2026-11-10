import { sleep } from '@/sleep';

// How long to wait for the app to load its data before the first tap.
const FIRST_TAP_DELAY_MS = 1500;

// How long to wait between taps, for the previous one to take effect.
const NEXT_TAP_DELAY_MS = 700;

const TAPPABLE_SELECTOR = 'button, a, label, [role="button"]';

function isVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0;
}

// An element is found by its title, its accessible label, or its exact text.
function hasName(element: HTMLElement, name: string): boolean {
  return (
    element.title === name ||
    element.getAttribute('aria-label') === name ||
    element.textContent?.trim() === name
  );
}

function findTappable(name: string): HTMLElement | undefined {
  const candidates = document.querySelectorAll<HTMLElement>(TAPPABLE_SELECTOR);

  return [...candidates].find(candidate => {
    return isVisible(candidate) && hasName(candidate, name);
  });
}

// Taps each named control in turn, so that a headless screenshot can show
// what only appears after an interaction, such as an open menu.
export async function tapInOrder(names: string[]): Promise<void> {
  let delayMs = FIRST_TAP_DELAY_MS;

  for (const name of names) {
    await sleep(delayMs);
    delayMs = NEXT_TAP_DELAY_MS;

    const target = findTappable(name);

    if (!target) {
      console.warn(`preview found nothing to tap named "${name}"`);
      continue;
    }

    target.click();
  }
}
