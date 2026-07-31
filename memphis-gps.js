(() => {
  'use strict';

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function distanceMeters(a, b) {
    if (!a || !b) return null;
    const latA = finite(a.latitude);
    const lonA = finite(a.longitude);
    const latB = finite(b.latitude);
    const lonB = finite(b.longitude);
    if (latA == null || lonA == null || latB == null || lonB == null) return null;
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
    const observedAtMs = timestampMs(position.timestamp ?? position.observed_at, nowMs);
    const observationAgeMs = nowMs - observedAtMs;
    const campusRadius = Math.max(100, finite(geofence.campus_radius_meters) ?? 900);
    const locationRadius = Math.max(25, finite(geofence.location_radius_meters) ?? 120);
    const campus = {
      latitude: finite(geofence.campus_latitude),
      longitude: finite(geofence.campus_longitude),
    };
    const exact = {
      latitude: finite(geofence.location_latitude),
      longitude: finite(geofence.location_longitude),
    };
    const exactConfigured = geofence.location_configured === true
      && exact.latitude != null
      && exact.longitude != null;
    const coordinatesValid = latitude != null && longitude != null;
    const campusDistance = coordinatesValid ? distanceMeters(campus, { latitude, longitude }) : null;
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
    } else if (observationAgeMs < -futureToleranceMs) {
      result = 'gps_future_clock';
      badge = 'Phone clock is ahead — waiting for a fresh GPS reading';
    } else if (observationAgeMs > maxAgeMs) {
      result = 'gps_stale';
      badge = 'GPS reading is stale — waiting for a fresh location';
    } else if (accuracy == null || accuracy > maxAccuracy) {
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
      observed_at: new Date(observedAtMs).toISOString(),
      observation_age_seconds: Math.round(observationAgeMs / 1000),
      motion_distance_m: motionDistanceM == null ? null : Math.round(motionDistanceM),
      motion_effective_distance_m: motionEffectiveDistanceM == null ? null : Math.round(motionEffectiveDistanceM),
      motion_speed_mps: motionSpeedMps == null ? null : Math.round(motionSpeedMps * 100) / 100,
      authoritative: result === 'inside_scanned_location' || result === 'outside_scanned_location' || result === 'offsite_outside_zoo_campus',
    };
  }

  const api = { distanceMeters, evaluate, timestampMs };
  if (typeof window !== 'undefined') window.MemphisGps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
