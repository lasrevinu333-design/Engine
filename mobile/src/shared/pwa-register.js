(() => {
  if (location.protocol === 'file:' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(() => {
      // Installation support is optional at runtime. The normal web app remains
      // usable and no employee- or manager-facing technical error is shown.
    });
  }, { once: true });
})();
