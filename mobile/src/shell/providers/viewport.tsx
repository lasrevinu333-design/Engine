import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { measureViewport } from '../core/viewport';

export function ViewportProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const visual = window.visualViewport;
      const measurement = measureViewport(
        window.innerHeight,
        visual?.height ?? window.innerHeight,
        visual?.offsetTop ?? 0,
        visual?.scale ?? 1,
      );
      root.style.setProperty('--mz-visual-viewport-height', `${measurement.viewportHeight}px`);
      root.style.setProperty('--mz-visual-viewport-offset-top', `${measurement.viewportOffsetTop}px`);
      root.style.setProperty('--mz-keyboard-height', `${measurement.keyboardHeight}px`);
      root.dataset.keyboardOpen = String(measurement.keyboardOpen);
      root.dataset.viewportScale = String(measurement.scale);
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  return children;
}
