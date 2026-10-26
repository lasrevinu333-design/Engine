import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const geo = require('../custodial-gps-geo-registration.js');
const pathModel = require('../custodial-gps-path-model.js');
const anchorBytes = fs.readFileSync(new URL('../dashboard-map-assets/approved-map-47-placement-anchors.json', import.meta.url));
const pngBytes = fs.readFileSync(new URL('../dashboard-map-assets/Memphis-Zoo-Transparent-Framed-Clean-Base-20261003.png', import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(anchorBytes), geo.ANCHOR_SHA);
assert.equal(sha(pngBytes), geo.ARTWORK_SHA);
const saved = JSON.parse(anchorBytes);
const anchors = { digest: geo.ANCHOR_SHA, width: 1282, height: 550,
  locations: saved.locations.map(item => ({ canvasPoint: item.approvedOverlayCanvasPoint })) };

// Purely synthetic affine fixture. It is never packaged as zoo control data.
const feature = (id, x, y) => ({ id, canvas: { x, y },
  latitude: 0.001 - y * 0.5 / 111132.92,
  longitude: 0.001 + x * 0.5 / 111319.49,
  uncertaintyM: 1, evidenceId: `unit-reference-${id}` });
const training = [[0, 0], [641, 0], [1282, 0], [0, 550], [641, 550], [1282, 550]]
  .map(([x, y], i) => feature(`train-${i}`, x, y));
const holdout = [[200, 200], [700, 300], [1100, 400]]
  .map(([x, y], i) => feature(`check-${i}`, x, y));
const controls = { schema: 'custodial.surveyed-map-controls.v1', artworkSha256: geo.ARTWORK_SHA,
  anchorSha256: geo.ANCHOR_SHA, canvasWidth: 1282, canvasHeight: 550,
  status: 'APPROVED_SURVEY_CONTROL', datum: 'EPSG:4326', sourceKind: 'verified_geospatial_reference',
  surveyEvidenceId: 'unit-reference-collection', surveyReviewedAt: '2026-10-09T00:00:00Z',
  training, holdout, maximumResidualM: 2, maximumObservationAccuracyM: 10,
  maximumUncertaintyM: 20 };
const rejects = (candidate, reason) => assert.throws(() => geo.admit({ controls: candidate, anchors }), reason);
rejects({ ...controls, status: 'FROZEN_REVIEW_CANDIDATE_NOT_APPLIED' }, /reviewed survey evidence/);
rejects({ ...controls, surveyEvidenceId: 'synthetic test' }, /reviewed survey evidence/);
rejects({ ...controls, artworkSha256: saved.immutableSource.baseImageSha256 }, /reviewed survey evidence/);
rejects({ ...controls, training: training.slice(0, 3) }, /reviewed survey evidence/);
rejects({ ...controls, surveyReviewedAt: '2999-01-01T00:00:00Z' }, /reviewed survey evidence/);
rejects({ ...controls, holdout: [{ ...holdout[0], canvas: training[0].canvas }, ...holdout.slice(1)] },
  /independent physical features/);
rejects({ ...controls, holdout: holdout.map((c, i) => i === 0 ? { ...c, latitude: c.latitude + .001 } : c) },
  /holdout residual/);
assert.throws(() => geo.admit({ controls, anchors: { ...anchors,
  locations: [{ canvasPoint: { x: 1300, y: 250 } }, ...anchors.locations.slice(1)] } }),
  /survey training envelope/);
const registration = geo.admit({ controls, anchors });
assert.ok(registration.quality.maxResidualM < 1e-6);
const pin = registration.project(holdout[0].latitude, holdout[0].longitude, 3);
assert.equal(pin.ok, true);
assert.ok(Math.abs(pin.canvas.x - 200) < 1e-6 && Math.abs(pin.canvas.y - 200) < 1e-6);
assert.ok(pin.uncertaintyM > 3 && pin.uncertaintyCanvasPx > 0);
assert.equal(registration.project(holdout[0].latitude, holdout[0].longitude, 11).reason,
  'invalid_or_low_accuracy_observation');
assert.equal(registration.project(.001, .05, 3).reason, 'outside_survey_control_envelope');
assert.equal(registration.project(feature('edge', 1, 1).latitude, feature('edge', 1, 1).longitude, 3).reason,
  'uncertainty_outside_control_envelope');

const session = { uuid: 'one-session', sessionId: 'server-session-1', locationCode: 'AQUX', deviceIdentifier: 'device-1',
  employeeId: 'employee-1', status: 'active', startedAt: '2026-10-09T12:00:00Z' };
const observation = (id, seconds, x, y, overrides = {}) => ({ id,
  event_type: 'work_position_check', session_uuid: session.uuid, location_code: session.locationCode,
  device_identifier: session.deviceIdentifier, employee_id: session.employeeId,
  payload_json: { session_uuid: session.uuid, location_code: session.locationCode,
    device_identifier: session.deviceIdentifier, observed_at: new Date(Date.parse(session.startedAt) + seconds * 1000).toISOString(),
    client_latitude: feature('position', x, y).latitude,
    client_longitude: feature('position', x, y).longitude, accuracy_m: 3 }, ...overrides });
const observations = [observation('a', 10, 200, 200), observation('b', 40, 220, 210),
  observation('wrong-actor', 55, 240, 220, { employee_id: 'other-employee' }),
  observation('bad-accuracy', 60, 250, 220, { payload_json: { ...observation('x', 60, 250, 220).payload_json, accuracy_m: 40 } }),
  observation('c', 80, 270, 230), observation('d', 200, 290, 240)];
const model = pathModel.path({ registration, observations, session, now: Date.parse(session.startedAt) + 210000 });
assert.deepEqual(model.segments.map(segment => segment.map(item => item.eventId)), [['a', 'b'], ['c'], ['d']]);
assert.deepEqual(model.rejected.map(item => item.eventId), ['wrong-actor', 'bad-accuracy']);
assert.equal(model.current.eventId, 'd');
const serverBound = observation('server-bound', 30, 230, 215, {
  session_id: session.sessionId,
  payload_json: { ...observation('x', 30, 230, 215).payload_json,
    session_uuid: undefined, location_code: undefined, device_identifier: undefined } });
assert.equal(pathModel.path({ registration, observations: [serverBound], session,
  now: Date.parse(session.startedAt) + 40000 }).current.eventId, 'server-bound');
const newerBad = observation('newer-bad', 205, 300, 250, {
  payload_json: { ...observation('x', 205, 300, 250).payload_json, accuracy_m: 40 } });
assert.equal(pathModel.path({ registration, observations: [...observations, newerBad], session,
  now: Date.parse(session.startedAt) + 210000 }).current, null);
assert.equal(pathModel.path({ registration, observations, session, now: Date.parse(session.startedAt) + 400000 }).current, null);
assert.throws(() => pathModel.path({ registration, observations, session: { ...session, status: 'complete' } }),
  /active session identity/);
console.log('PASS: approved-asset binding, fail-closed control admission, holdout/envelope/uncertainty, session path gaps');
