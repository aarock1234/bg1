'use strict';

// Which setup steps have been ticked off, by platform, so that leaving for
// another app and coming back doesn't lose your place.
const PROGRESS_KEY = 'bg1.setup.progress';

const platformSelect = document.getElementById('platform');
const stepLists = [...document.querySelectorAll('.steps')];

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

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function doneSteps(platform) {
  return new Set(loadProgress()[platform] ?? []);
}

function setStepDone(platform, step, isDone) {
  const done = doneSteps(platform);

  if (isDone) {
    done.add(step);
  } else {
    done.delete(step);
  }

  saveProgress({
    ...loadProgress(),
    [platform]: [...done],
  });
}

// Shows one platform's steps: finished ones collapsed with a tick, the first
// unfinished one open, and the rest collapsed until their turn.
function showSteps(platform) {
  const done = doneSteps(platform);

  for (const list of stepLists) {
    list.hidden = list.dataset.platform !== platform;
  }

  const steps = document.querySelectorAll(
    `.steps[data-platform="${platform}"] > li`
  );
  let hasCurrentStep = false;

  for (const step of steps) {
    const isDone = done.has(step.dataset.step);
    const isCurrent = !isDone && !hasCurrentStep;

    hasCurrentStep ||= isCurrent;
    step.classList.toggle('is-done', isDone);
    step.classList.toggle('is-current', isCurrent);
    step.querySelector('.mark').textContent = isDone ? 'Undo' : 'Done';
  }
}

function addMarkButtons() {
  for (const step of document.querySelectorAll('.steps > li')) {
    const button = document.createElement('button');
    const { platform } = step.parentElement.dataset;

    button.type = 'button';
    button.className = 'mark';
    button.addEventListener('click', () => {
      setStepDone(
        platform,
        step.dataset.step,
        !step.classList.contains('is-done')
      );
      showSteps(platform);
    });

    step.append(button);
  }
}

addMarkButtons();
platformSelect.value = detectPlatform();
platformSelect.addEventListener('change', () => {
  showSteps(platformSelect.value);
});
showSteps(platformSelect.value);
