// Keyboard access to the existing horizontal forecast strip. This changes
// presentation only; it never reads or alters weather authority or cards.
export function installHourlyForecastKeyboard(strip) {
  if (!strip || typeof strip.addEventListener !== 'function') return () => {};
  const onKeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const width = Number(strip.clientWidth);
    const extent = Number(strip.scrollWidth);
    if (!Number.isFinite(width) || !Number.isFinite(extent) || width <= 0 || extent <= width) return;
    const limit = extent - width;
    const current = Math.max(0, Math.min(limit, Number(strip.scrollLeft) || 0));
    const step = Math.max(48, Math.min(width * 0.75, 240));
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? limit
        : event.key === 'ArrowRight' ? Math.min(limit, current + step)
          : Math.max(0, current - step);
    event.preventDefault(); // Keep these strip keys from moving the root page.
    strip.scrollLeft = next;
  };
  strip.addEventListener('keydown', onKeydown);
  return () => strip.removeEventListener('keydown', onKeydown);
}
