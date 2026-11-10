// Calls the callback whenever the page becomes visible again. Returns a
// function that stops it.
export default function onVisible(callback: () => void): () => void {
  function onVisibilityChange() {
    if (!document.hidden) {
      callback();
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
