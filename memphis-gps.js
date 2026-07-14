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

  function evaluate(position = {}, geofence = {}) {
    const latitude = finite(position.latitude);
    const longitude = finite(position.longitude);
    const accuracy = finite(position.accuracy_m ?? position.accuracy);
    const maxAccuracy = Math.max(10, finite(geofence.max_accuracy_meters) ?? 100);
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

    let result = 'gps_unverified';
    let badge = 'Location check unavailable';
    let badgeKind = 'warn';

    if (!coordinatesValid) {
      result = 'gps_unavailable';
      badge = 'Location unavailable';
    } else if (accuracy == null || accuracy > maxAccuracy) {
      result = 'gps_low_accuracy';
      badge = `GPS accuracy too low (${accuracy == null ? '?' : Math.round(accuracy)}m)`;
    } else if (campusDistance == null) {
      result = 'gps_unconfigured';
      badge = 'Zoo GPS boundary is not configured';
    } else if (campusDistance > campusRadius + accuracy) {
      result = 'offsite_outside_zoo_campus';
      badge = `OFFSITE — ${Math.round(campusDistance)}m from zoo campus`;
      badgeKind = 'alert';
    } else if (!exactConfigured) {
      result = 'onsite_location_unverified';
      badge = 'On zoo campus — exact location not calibrated';
    } else if (locationDistance > locationRadius + accuracy) {
      result = 'outside_scanned_location';
      badge = `OUTSIDE SCANNED AREA — ${Math.round(locationDistance)}m away`;
      badgeKind = 'alert';
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
    };
  }

  const api = { distanceMeters, evaluate };
  if (typeof window !== 'undefined') window.MemphisGps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
