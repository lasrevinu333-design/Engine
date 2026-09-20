(() => {
  'use strict';

  function finite(value) {
    if (value == null || (typeof value !== 'number' && typeof value !== 'string')
      || (typeof value === 'string' && !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  // Source-input safety only: these bounds do not claim surveyed calibration.
  // Every authoritative geofence must still provide its own explicit radius.
  // The 5 km ceiling preserves the largest existing explicit test contract
  // while preventing corrupt or effectively unbounded radius input.
  const GPS_RADIUS_INPUT_POLICY_V1 = Object.freeze({
    contract_version: 'gps-radius-input-policy.v1',
    campus: Object.freeze({ minimum_meters: 100, maximum_meters: 5000 }),
    location: Object.freeze({ minimum_meters: 25, maximum_meters: 5000 }),
  });

  function calibratedRadius(value, policy) {
    const radius = finite(value);
    if (radius == null || radius < policy.minimum_meters || radius > policy.maximum_meters) return null;
    return radius;
  }

  function distanceMeters(a, b) {
    if (!a || !b) return null;
    const latA = finite(a.latitude);
    const lonA = finite(a.longitude);
    const latB = finite(b.latitude);
    const lonB = finite(b.longitude);
    if (latA == null || lonA == null || latB == null || lonB == null
      || Math.abs(latA)>90 || Math.abs(latB)>90 || Math.abs(lonA)>180 || Math.abs(lonB)>180) return null;
    const radius = 6371000;
    const radians = (value) => value * Math.PI / 180;
    const lat1 = radians(latA);
    const lat2 = radians(latB);
    const deltaLat = radians(latB - latA);
    const deltaLon = radians(lonB - lonA);
    const haversine = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }

  function timestampMs(value, fallback = Date.now()) {
    if (value == null || value === '') return fallback;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function evaluate(position = {}, geofence = {}, previousPosition = null) {
    const latitude = finite(position.latitude);
    const longitude = finite(position.longitude);
    const accuracy = finite(position.accuracy_m ?? position.accuracy);
    const maxAccuracy = Math.max(10, finite(geofence.max_accuracy_meters) ?? 100);
    const maxAgeMs = Math.max(30000, (finite(geofence.max_observation_age_seconds) ?? 120) * 1000);
    const futureToleranceMs = Math.max(0, (finite(geofence.future_tolerance_seconds) ?? 30) * 1000);
    const boundaryHysteresis = Math.max(5, finite(geofence.boundary_hysteresis_meters) ?? 15);
    const maxHumanSpeedMps = Math.max(2, finite(geofence.max_human_speed_mps) ?? 12);
    const nowMs = finite(geofence.now_ms) ?? Date.now();
    const capture=position.timestamp ?? position.observed_at;
    const observedAtMs = capture==null || typeof capture==='string'&&!capture.trim() ? null : timestampMs(capture, null);
    const observationAgeMs = nowMs - observedAtMs;
    const campusRadius = calibratedRadius(geofence.campus_radius_meters, GPS_RADIUS_INPUT_POLICY_V1.campus);
    const locationRadius = calibratedRadius(geofence.location_radius_meters, GPS_RADIUS_INPUT_POLICY_V1.location);
    const campus = {
      latitude: finite(geofence.campus_latitude),
      longitude: finite(geofence.campus_longitude),
    };
    const exact = {
      latitude: finite(geofence.location_latitude),
      longitude: finite(geofence.location_longitude),
    };
    const campusConfigured = campusRadius != null
      && campus.latitude != null
      && campus.longitude != null && Math.abs(campus.latitude)<=90 && Math.abs(campus.longitude)<=180;
    const exactConfigured = locationRadius != null
      && geofence.location_configured === true
      && exact.latitude != null
      && exact.longitude != null && Math.abs(exact.latitude)<=90 && Math.abs(exact.longitude)<=180;
    const coordinatesValid = latitude != null && longitude != null && Math.abs(latitude)<=90 && Math.abs(longitude)<=180;
    const campusDistance = coordinatesValid && campusConfigured ? distanceMeters(campus, { latitude, longitude }) : null;
    const locationDistance = coordinatesValid && exactConfigured
      ? distanceMeters(exact, { latitude, longitude })
      : null;
    const uncertainty = Math.max(boundaryHysteresis, Math.min(Math.max(accuracy ?? 0, 0), maxAccuracy));
    const previousObservedAtMs = previousPosition ? timestampMs(previousPosition.timestamp ?? previousPosition.observed_at, null) : null;
    const motionElapsedSeconds = previousObservedAtMs != null && observedAtMs > previousObservedAtMs
      ? (observedAtMs - previousObservedAtMs) / 1000
      : null;
    const motionDistanceM = motionElapsedSeconds != null ? distanceMeters(previousPosition, { latitude, longitude }) : null;
    const previousAccuracy = finite(previousPosition?.accuracy_m ?? previousPosition?.accuracy);
    const motionEffectiveDistanceM = motionDistanceM == null
      ? null
      : Math.max(0, motionDistanceM - Math.max(accuracy ?? 0, 0) - Math.max(previousAccuracy ?? 0, 0));
    const motionSpeedMps = motionEffectiveDistanceM != null ? motionEffectiveDistanceM / Math.max(motionElapsedSeconds, 0.001) : null;

    let result = 'gps_unverified';
    let badge = 'Location check unavailable';
    let badgeKind = 'warn';

    if (!coordinatesValid) {
      result = 'gps_unavailable';
      badge = 'Location unavailable';
    } else if (observedAtMs == null) {
      result = 'gps_timestamp_unavailable';
      badge = 'GPS capture time is unavailable';
    } else if (observationAgeMs < -futureToleranceMs) {
      result = 'gps_future_clock';
      badge = 'Phone clock is ahead — waiting for a fresh GPS reading';
    } else if (observationAgeMs > maxAgeMs) {
      result = 'gps_stale';
      badge = 'GPS reading is stale — waiting for a fresh location';
    } else if (accuracy == null || accuracy < 0 || accuracy > maxAccuracy) {
      result = 'gps_low_accuracy';
      badge = `GPS accuracy too low (${accuracy == null ? '?' : Math.round(accuracy)}m)`;
    } else if (motionSpeedMps != null && motionSpeedMps > maxHumanSpeedMps) {
      result = 'gps_implausible_jump';
      badge = 'GPS changed too quickly — waiting for a stable reading';
    } else if (campusDistance == null) {
      result = 'gps_unconfigured';
      badge = 'Zoo GPS boundary is not configured';
    } else if (campusDistance > campusRadius + accuracy) {
      result = 'offsite_outside_zoo_campus';
      badge = `OFFSITE — ${Math.round(campusDistance)}m from zoo campus`;
      badgeKind = 'alert';
    } else if (Math.abs(campusDistance - campusRadius) <= uncertainty) {
      result = 'campus_boundary_uncertain';
      badge = 'Near the zoo GPS boundary — checking again';
    } else if (!exactConfigured) {
      result = 'onsite_location_unverified';
      badge = 'On zoo campus — exact location not calibrated';
    } else if (locationDistance > locationRadius + accuracy) {
      result = 'outside_scanned_location';
      badge = `OUTSIDE SCANNED AREA — ${Math.round(locationDistance)}m away`;
      badgeKind = 'alert';
    } else if (Math.abs(locationDistance - locationRadius) <= uncertainty) {
      result = 'gps_boundary_uncertain';
      badge = 'Near the scanned-area boundary — checking again';
    } else {
      result = 'inside_scanned_location';
      badge = 'GPS verified at scanned location';
      badgeKind = 'ok';
    }

    return {
      result,
      badge,
      badgeKind,
      accuracy_m: accuracy == null ? null : Math.round(accuracy),
      max_accuracy_meters: maxAccuracy,
      campus_distance_m: campusDistance == null ? null : Math.round(campusDistance),
      campus_radius_m: campusRadius,
      location_distance_m: locationDistance == null ? null : Math.round(locationDistance),
      location_radius_m: locationRadius,
      location_geofence_configured: exactConfigured,
      observed_at: observedAtMs == null ? null : new Date(observedAtMs).toISOString(),
      observation_age_seconds: observedAtMs == null ? null : Math.round(observationAgeMs / 1000),
      motion_distance_m: motionDistanceM == null ? null : Math.round(motionDistanceM),
      motion_effective_distance_m: motionEffectiveDistanceM == null ? null : Math.round(motionEffectiveDistanceM),
      motion_speed_mps: motionSpeedMps == null ? null : Math.round(motionSpeedMps * 100) / 100,
      authoritative: result === 'inside_scanned_location' || result === 'outside_scanned_location' || result === 'offsite_outside_zoo_campus',
    };
  }

  const api = { GPS_RADIUS_INPUT_POLICY_V1, distanceMeters, evaluate, timestampMs };
  if (typeof window !== 'undefined') window.MemphisGps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
