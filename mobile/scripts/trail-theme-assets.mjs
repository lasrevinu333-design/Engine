// Explicit native presentation inputs, including common viewer assets.
// Viewer skips root web graph copying, so its root CSS and every CSS URL input
// must be copied here as well as the edition adapters.
// Exact-source and runtime-manifest validation remain owned by build.mjs.
const iconFiles = Object.freeze([
  "assets/trail-v1/dashboard-64.webp",
  "assets/trail-v1/map-64.webp",
  "assets/trail-v1/messenger-64.webp",
  "assets/trail-v1/schedule-64.webp",
  "assets/trail-v1/staffing-64.webp",
  "assets/trail-v1/insights-64.webp",
  "assets/trail-v1/events-64.webp",
  "assets/trail-v1/feedback-64.webp",
  "assets/trail-v1/notifications-64.webp",
  "assets/trail-v1/unfinished-64.webp",
  "assets/trail-v1/phones-64.webp",
  "assets/trail-v1/supplies-64.webp"
]);
const commonFiles = Object.freeze([
  "trail-terracotta.css",
  "assets/trail-v1/terracotta.webp",
  "assets/trail-v1/dashboard.svg",
  "assets/trail-v1/map.svg",
  "assets/trail-v1/messenger.svg",
  "assets/trail-v1/schedule.svg",
  "assets/trail-v1/staffing.svg",
  "assets/trail-v1/insights.svg",
  "assets/trail-v1/events.svg",
  "assets/trail-v1/feedback.svg",
  "assets/trail-v1/notifications.svg",
  "assets/trail-v1/unfinished.svg",
  "assets/trail-v1/phones.svg",
  "assets/trail-v1/supplies.svg"
]);
const editionFiles = Object.freeze({
  custodial: ['trail-pages/custodial-index.css'],
  manager: ['trail-pages/manager-index.css', 'trail-pages/manager-notifications.css', 'trail-pages/manager-manager-access.css', 'trail-pages/web-install-manager-offline.css'],
  viewer: ['trail-pages/viewer-index.css', 'trail-pages/web-install-viewer-offline.css'],
});
export function trailSourcePresentationFiles(edition) {
  if (!Object.hasOwn(editionFiles, edition)) throw new Error('Unsupported Trail presentation edition');
  return [...commonFiles, ...iconFiles, ...editionFiles[edition]];
}
