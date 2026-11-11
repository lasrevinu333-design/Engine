export const MAP_WIDTH = 2048;
export const MAP_HEIGHT = 1536;
export const MAP_ID = 'memphis-zoo-infrastructure-site-plan-2016-calibration-v1';

export const GEO_TRANSFORM = Object.freeze({
  latA: 1.017486435614195e-7,
  latB: -6.147168995032209e-6,
  latC: 35.15428949602021,
  lonA: 6.429163611753567e-6,
  lonB: 1.389594047316773e-7,
  lonC: -89.99892533409566
});

export const CONTROL_POINTS = Object.freeze([
  Object.freeze({ name: 'Aquarium', x: 246.275, y: 342.7916666667, latitude: 35.152207355862316, longitude: -89.99729435770122 }),
  Object.freeze({ name: 'Zambezi Rondavel', x: 927.301369863, y: 703.493150685, latitude: 35.15005935639266, longitude: -89.99286580488196 }),
  Object.freeze({ name: 'Teton Trek Lodge', x: 1565.101265823, y: 796.0, latitude: 35.149555596431, longitude: -89.98875243030255 })
]);

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
  return number;
}

export function pixelToCoordinates(xInput, yInput) {
  const x = finite(xInput, 'x');
  const y = finite(yInput, 'y');
  const t = GEO_TRANSFORM;
  return Object.freeze({
    latitude: t.latA * x + t.latB * y + t.latC,
    longitude: t.lonA * x + t.lonB * y + t.lonC
  });
}

export function coordinatesToPixel(latitudeInput, longitudeInput) {
  const latitude = finite(latitudeInput, 'latitude');
  const longitude = finite(longitudeInput, 'longitude');
  const t = GEO_TRANSFORM;
  const latDelta = latitude - t.latC;
  const lonDelta = longitude - t.lonC;
  const determinant = t.latA * t.lonB - t.latB * t.lonA;
  if (Math.abs(determinant) < Number.EPSILON) throw new Error('Map calibration transform is not invertible.');
  return Object.freeze({
    x: (latDelta * t.lonB - lonDelta * t.latB) / determinant,
    y: (t.latA * lonDelta - t.lonA * latDelta) / determinant
  });
}

export function isPixelInsideMap({ x, y }, tolerance = 0) {
  const margin = Math.max(0, finite(tolerance, 'tolerance'));
  return x >= -margin && y >= -margin && x <= MAP_WIDTH + margin && y <= MAP_HEIGHT + margin;
}
