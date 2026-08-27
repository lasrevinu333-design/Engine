import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTROL_POINTS,
  coordinatesToPixel,
  isPixelInsideMap,
  pixelToCoordinates
} from '../src/config/calibration.js';

const coordinateTolerance = 1e-10;
const pixelTolerance = 1e-6;

test('each exact control point survives pixel-to-coordinate conversion', () => {
  for (const point of CONTROL_POINTS) {
    const calculated = pixelToCoordinates(point.x, point.y);
    assert.ok(Math.abs(calculated.latitude - point.latitude) < coordinateTolerance, `${point.name} latitude mismatch`);
    assert.ok(Math.abs(calculated.longitude - point.longitude) < coordinateTolerance, `${point.name} longitude mismatch`);
  }
});

test('each exact control point survives coordinate-to-pixel conversion', () => {
  for (const point of CONTROL_POINTS) {
    const calculated = coordinatesToPixel(point.latitude, point.longitude);
    assert.ok(Math.abs(calculated.x - point.x) < pixelTolerance, `${point.name} x mismatch`);
    assert.ok(Math.abs(calculated.y - point.y) < pixelTolerance, `${point.name} y mismatch`);
    assert.equal(isPixelInsideMap(calculated), true);
  }
});

test('arbitrary calibrated point round-trips', () => {
  const original = { x: 1012.25, y: 688.75 };
  const coordinates = pixelToCoordinates(original.x, original.y);
  const restored = coordinatesToPixel(coordinates.latitude, coordinates.longitude);
  assert.ok(Math.abs(restored.x - original.x) < pixelTolerance);
  assert.ok(Math.abs(restored.y - original.y) < pixelTolerance);
});
