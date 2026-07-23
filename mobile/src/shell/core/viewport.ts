export interface ViewportMeasurement {
  viewportHeight: number;
  viewportOffsetTop: number;
  keyboardHeight: number;
  keyboardOpen: boolean;
  scale: number;
}

export function measureViewport(
  layoutHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
  scale: number,
): ViewportMeasurement {
  const safeLayoutHeight = Math.max(0, Number(layoutHeight) || 0);
  const safeVisualHeight = Math.max(0, Number(visualHeight) || safeLayoutHeight);
  const safeOffset = Math.max(0, Number(visualOffsetTop) || 0);
  const safeScale = Math.max(0.1, Number(scale) || 1);
  const zoomed = safeScale > 1.05;
  const occludedHeight = zoomed
    ? 0
    : Math.max(0, safeLayoutHeight - safeVisualHeight - safeOffset);
  const keyboardHeight = occludedHeight >= 80 ? occludedHeight : 0;
  return {
    viewportHeight: safeVisualHeight,
    viewportOffsetTop: zoomed ? 0 : safeOffset,
    keyboardHeight,
    keyboardOpen: keyboardHeight > 0,
    scale: safeScale,
  };
}
