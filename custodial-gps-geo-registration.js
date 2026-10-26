(function (root) {
  'use strict';

  // Geographic controls belong to the approved PNG's final 1282 x 550 canvas.
  // This module contains no zoo coordinates and cannot admit a visual pin fit.
  const ANCHOR_SHA = '3bf0761cb42f1e5f9b435ae3774ea3c018c749daf261de44357880ae3841ebef';
  const ARTWORK_SHA = '73d4d6116819d34b0c5e6d35bf0d3c8397d582445fb92bf734fc6448fbb3a57a';
  const METRES_PER_DEGREE_LAT = 111132.92;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const point = value => finite(value?.x) && finite(value?.y);
  const fail = reason => { throw new Error(`Geographic map: ${reason}`); };

  function solve3(rows, values) {
    const matrix = [0, 1, 2].map(i => [
      rows.reduce((sum, row) => sum + row[i] * row[0], 0),
      rows.reduce((sum, row) => sum + row[i] * row[1], 0),
      rows.reduce((sum, row) => sum + row[i] * row[2], 0),
      rows.reduce((sum, row, j) => sum + row[i] * values[j], 0)
    ]);
    for (let col = 0; col < 3; col++) {
      let pivot = col;
      for (let row = col + 1; row < 3; row++)
        if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
      if (Math.abs(matrix[pivot][col]) < 1e-8) fail('survey controls are collinear or unstable');
      [matrix[pivot], matrix[col]] = [matrix[col], matrix[pivot]];
      const divisor = matrix[col][col];
      for (let k = col; k < 4; k++) matrix[col][k] /= divisor;
      for (let row = 0; row < 3; row++) if (row !== col) {
        const factor = matrix[row][col];
        for (let k = col; k < 4; k++) matrix[row][k] -= factor * matrix[col][k];
      }
    }
    return matrix.map(row => row[3]);
  }
  function hull(points) {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const half = values => { const result = []; for (const item of values) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), item) <= 0) result.pop();
      result.push(item);
    } return result; };
    return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
  }
  function inside(p, polygon) {
    return polygon.length >= 3 && polygon.every((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-6;
    });
  }
  function captureTime(raw) {
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) return NaN;
    return Date.parse(raw);
  }

  function admit({ controls, anchors }) {
    if (anchors?.digest !== ANCHOR_SHA || anchors.width !== 1282 || anchors.height !== 550 ||
        anchors.locations?.length !== 47) fail('exact approved 47-pin canvas is required');
    if (controls?.schema !== 'custodial.surveyed-map-controls.v1' ||
        controls.artworkSha256 !== ARTWORK_SHA || controls.anchorSha256 !== ANCHOR_SHA ||
        controls.canvasWidth !== 1282 || controls.canvasHeight !== 550 ||
        controls.status !== 'APPROVED_SURVEY_CONTROL' || controls.datum !== 'EPSG:4326' ||
        !['independent_survey', 'verified_geospatial_reference'].includes(controls.sourceKind) ||
        typeof controls.surveyEvidenceId !== 'string' || !controls.surveyEvidenceId.trim() ||
        /synthetic|fixture|test|draft|visual/i.test(controls.surveyEvidenceId) ||
        !finite(captureTime(controls.surveyReviewedAt)) ||
        captureTime(controls.surveyReviewedAt) > Date.now() ||
        !Array.isArray(controls.training) || controls.training.length < 6 ||
        !Array.isArray(controls.holdout) || controls.holdout.length < 3 ||
        !finite(controls.maximumResidualM) || controls.maximumResidualM <= 0 ||
        !finite(controls.maximumObservationAccuracyM) || controls.maximumObservationAccuracyM <= 0 ||
        !finite(controls.maximumUncertaintyM) || controls.maximumUncertaintyM <= 0)
      fail('reviewed survey evidence and explicit quality limits are required');
    const all = [...controls.training, ...controls.holdout];
    const ids = new Set(), pixels = new Set();
    for (const c of all) {
      if (typeof c.id !== 'string' || !c.id || ids.has(c.id) || !point(c.canvas) ||
          c.canvas.x < 0 || c.canvas.x > 1282 || c.canvas.y < 0 || c.canvas.y > 550 ||
          !finite(c.latitude) || Math.abs(c.latitude) > 90 ||
          !finite(c.longitude) || Math.abs(c.longitude) > 180 ||
          !finite(c.uncertaintyM) || c.uncertaintyM <= 0 ||
          typeof c.evidenceId !== 'string' || !c.evidenceId ||
          /synthetic|fixture|test|draft|visual/i.test(c.evidenceId))
        fail('each distinct survey feature needs measured coordinates, canvas point and uncertainty');
      ids.add(c.id);
      const pixelKey = `${c.canvas.x.toFixed(5)}:${c.canvas.y.toFixed(5)}`;
      if (pixels.has(pixelKey)) fail('survey holdouts must be independent physical features');
      pixels.add(pixelKey);
    }
    const origin = controls.training[0];
    const eastScale = 111319.49 * Math.cos(origin.latitude * Math.PI / 180);
    if (Math.abs(eastScale) < 1) fail('longitude scale is unstable');
    const metres = c => ({ east: (c.longitude - origin.longitude) * eastScale,
      north: (c.latitude - origin.latitude) * METRES_PER_DEGREE_LAT });
    const rows = controls.training.map(c => [c.canvas.x, c.canvas.y, 1]);
    const east = solve3(rows, controls.training.map(c => metres(c).east));
    const north = solve3(rows, controls.training.map(c => metres(c).north));
    const determinant = east[0] * north[1] - east[1] * north[0];
    if (Math.abs(determinant) < 1e-8) fail('geographic registration is not invertible');
    const residual = c => {
      const m = metres(c), x = c.canvas.x, y = c.canvas.y;
      return Math.hypot(east[0] * x + east[1] * y + east[2] - m.east,
        north[0] * x + north[1] * y + north[2] - m.north);
    };
    const maxResidualM = Math.max(...all.map(residual));
    if (maxResidualM > controls.maximumResidualM) fail('training or independent holdout residual exceeds survey limit');
    const polygon = hull(controls.training.map(c => c.canvas));
    if (anchors.locations.some(c => !inside(c.canvasPoint, polygon)))
      fail('survey training envelope does not contain all 47 approved scan placements');
    const controlUncertaintyM = Math.max(...all.map(c => c.uncertaintyM));
    const registrationUncertaintyM = Math.hypot(controlUncertaintyM, maxResidualM);
    if (registrationUncertaintyM > controls.maximumUncertaintyM)
      fail('survey control uncertainty exceeds display limit');
    function project(latitude, longitude, accuracyM) {
      if (!finite(latitude) || Math.abs(latitude) > 90 || !finite(longitude) || Math.abs(longitude) > 180 ||
          !finite(accuracyM) || accuracyM <= 0 || accuracyM > controls.maximumObservationAccuracyM)
        return { ok: false, reason: 'invalid_or_low_accuracy_observation' };
      const m = metres({ latitude, longitude });
      const de = m.east - east[2], dn = m.north - north[2];
      const canvas = { x: (north[1] * de - east[1] * dn) / determinant,
        y: (-north[0] * de + east[0] * dn) / determinant };
      if (!inside(canvas, polygon) || canvas.x < 0 || canvas.x > 1282 || canvas.y < 0 || canvas.y > 550)
        return { ok: false, reason: 'outside_survey_control_envelope' };
      const uncertaintyM = Math.hypot(accuracyM, registrationUncertaintyM);
      if (uncertaintyM > controls.maximumUncertaintyM)
        return { ok: false, reason: 'combined_uncertainty_exceeds_limit' };
      // A circular accuracy bound maps through the full inverse affine matrix.
      // Its largest singular value, not its largest column norm, bounds every
      // displacement direction (including shear).
      const inverseA = north[1] / determinant, inverseB = -east[1] / determinant;
      const inverseC = -north[0] / determinant, inverseD = east[0] / determinant;
      const columnOneSquared = inverseA * inverseA + inverseC * inverseC;
      const columnTwoSquared = inverseB * inverseB + inverseD * inverseD;
      const columnProduct = inverseA * inverseB + inverseC * inverseD;
      const pixelsPerM = Math.sqrt((columnOneSquared + columnTwoSquared +
        Math.hypot(columnOneSquared - columnTwoSquared, 2 * columnProduct)) / 2);
      const uncertaintyCanvasPx = uncertaintyM * pixelsPerM;
      const edgeDistance = Math.min(...polygon.map((a, i) => {
        const b = polygon[(i + 1) % polygon.length];
        return Math.abs((b.x - a.x) * (canvas.y - a.y) - (b.y - a.y) * (canvas.x - a.x)) /
          Math.hypot(b.x - a.x, b.y - a.y);
      }));
      if (uncertaintyCanvasPx > edgeDistance)
        return { ok: false, reason: 'uncertainty_outside_control_envelope' };
      return Object.freeze({ ok: true, canvas, uncertaintyM, uncertaintyCanvasPx,
        quality: 'measured_with_uncertainty', surveyEvidenceId: controls.surveyEvidenceId });
    }
    return Object.freeze({ project, quality: Object.freeze({ maxResidualM, registrationUncertaintyM,
      trainingCount: controls.training.length, holdoutCount: controls.holdout.length }),
      surveyEvidenceId: controls.surveyEvidenceId });
  }

  const api = Object.freeze({ admit, ANCHOR_SHA, ARTWORK_SHA });
  root.MemphisCustodialGpsGeoRegistration = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
