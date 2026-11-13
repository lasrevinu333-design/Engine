import { describe, expect, it } from 'vitest';
import { measureViewport } from './viewport';

describe('viewport measurement', () => {
  it('measures a visible software keyboard without negative geometry', () => {
    expect(measureViewport(844, 500, 0, 1)).toEqual({
      viewportHeight: 500,
      viewportOffsetTop: 0,
      keyboardHeight: 344,
      keyboardOpen: true,
      scale: 1,
    });
    expect(measureViewport(844, 844, 0, 0)).toEqual({
      viewportHeight: 844,
      viewportOffsetTop: 0,
      keyboardHeight: 0,
      keyboardOpen: false,
      scale: 1,
    });
  });

  it('applies shifted IME geometry without misclassifying pinch zoom', () => {
    expect(measureViewport(844, 500, 20, 1)).toEqual({
      viewportHeight: 500,
      viewportOffsetTop: 20,
      keyboardHeight: 324,
      keyboardOpen: true,
      scale: 1,
    });
    expect(measureViewport(844, 422, 100, 2)).toEqual({
      viewportHeight: 422,
      viewportOffsetTop: 0,
      keyboardHeight: 0,
      keyboardOpen: false,
      scale: 2,
    });
  });
});
