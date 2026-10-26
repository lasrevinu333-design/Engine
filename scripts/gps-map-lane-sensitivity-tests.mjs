import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pathModel = require('../custodial-gps-path-model.js');
const geo = require('../custodial-gps-geo-registration.js');

// Synthetic source sensitivity only. No Zoo measurement or control is used.
const session = { uuid: 'session-one', sessionId: 'db-session-one', employeeId: 'employee-one',
  locationCode: 'AQUX', deviceIdentifier: 'device-one', status: 'active',
  startedAt: '2026-10-09T12:00:00Z' };
const registration = { project: () => ({ ok: true, canvas: { x: 10, y: 10 },
  uncertaintyM: 3, uncertaintyCanvasPx: 3 }) };
function event(id, seconds, missingCapture = false) {
  const payload_json = { client_latitude: 0.001, client_longitude: 0.001, accuracy_m: 3 };
  if (!missingCapture) payload_json.observed_at = new Date(Date.parse(session.startedAt) + seconds * 1000).toISOString();
  return { id, event_type: 'work_position_check', session_uuid: session.uuid,
    session_id: session.sessionId, employee_id: session.employeeId,
    location_code: session.locationCode, device_identifier: session.deviceIdentifier, payload_json };
}
const result = pathModel.path({ registration,
  observations: [event('a', 20), event('missing-capture', 40, true), event('b', 60)],
  session, now: Date.parse(session.startedAt) + 70000 });
assert.deepEqual(result.rejected.map(item => item.eventId), ['missing-capture']);
assert.equal(result.chronologyUnknown, true);
assert.deepEqual(result.segments, []);
assert.equal(result.current, null);
console.log('PASS GPS-PATH-UNKNOWN-CAPTURE: unknown chronology withholds connected path and current dot');

// Synthetic shear: canvas-to-metres [[1,1],[0,1]]. The singular value of
// its inverse is larger than either inverse-column length.
const rawAnchors = JSON.parse(fs.readFileSync(new URL('../dashboard-map-assets/approved-map-47-placement-anchors.json', import.meta.url)));
const anchors = { digest: geo.ANCHOR_SHA, width: 1282, height: 550,
  locations: rawAnchors.locations.map(item => ({ canvasPoint: item.approvedOverlayCanvasPoint })) };
const originLat = 0.001, originLon = 0.001;
const eastScale = 111319.49 * Math.cos(originLat * Math.PI / 180);
function feature(id, x, y) { return { id, canvas: { x, y }, latitude: originLat + y / 111132.92,
  longitude: originLon + (x + y) / eastScale, uncertaintyM: 1, evidenceId: `unit-reference-${id}` }; }
const controls = { schema: 'custodial.surveyed-map-controls.v1', artworkSha256: geo.ARTWORK_SHA,
  anchorSha256: geo.ANCHOR_SHA, canvasWidth: 1282, canvasHeight: 550,
  status: 'APPROVED_SURVEY_CONTROL', datum: 'EPSG:4326', sourceKind: 'verified_geospatial_reference',
  surveyEvidenceId: 'unit-reference-collection', surveyReviewedAt: '2026-10-09T00:00:00Z',
  training: [[0, 0], [641, 0], [1282, 0], [0, 550], [641, 550], [1282, 550]]
    .map(([x, y], i) => feature(`train-${i}`, x, y)),
  holdout: [[200, 200], [700, 300], [1100, 400]].map(([x, y], i) => feature(`check-${i}`, x, y)),
  maximumResidualM: 0.001, maximumObservationAccuracyM: 10, maximumUncertaintyM: 20 };
const shearRegistration = geo.admit({ controls, anchors });
const sample = feature('position', 641, 275);
const projected = shearRegistration.project(sample.latitude, sample.longitude, 3);
assert.equal(projected.ok, true);
const sameInputRadius = Math.hypot(3, 1);
const largestInverseSingularValue = Math.sqrt((3 + Math.sqrt(5)) / 2);
assert.ok(projected.uncertaintyCanvasPx + 1e-7 >= sameInputRadius * largestInverseSingularValue,
  `uncertainty radius ${projected.uncertaintyCanvasPx} understated shear displacement`);
console.log('PASS GPS-UNCERTAINTY-SHEAR: circular envelope covers full inverse transform amplification');
