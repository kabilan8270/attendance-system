import { query } from '../config/db';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Haversine distance between two lat/lng points, in meters.
 */
export const distanceInMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

export interface GeoCheckResult {
  allowed: boolean;
  matchedLocationName?: string;
  distanceMeters?: number;
  reason?: string;
}

/**
 * Verifies that the given coordinates fall within at least one configured
 * active office location's geofence radius.
 */
export const verifyWithinOfficeGeofence = async (
  lat: number,
  lng: number
): Promise<GeoCheckResult> => {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { allowed: false, reason: 'Invalid GPS coordinates supplied' };
  }

  const result = await query(
    `SELECT name, latitude, longitude, radius_meters FROM office_locations WHERE is_active = TRUE`
  );

  if (result.rowCount === 0) {
    return { allowed: false, reason: 'No office location has been configured by admin' };
  }

  let closest: { name: string; distance: number; radius: number } | null = null;

  for (const office of result.rows) {
    const distance = distanceInMeters(lat, lng, office.latitude, office.longitude);
    if (!closest || distance < closest.distance) {
      closest = { name: office.name, distance, radius: office.radius_meters };
    }
    if (distance <= office.radius_meters) {
      return {
        allowed: true,
        matchedLocationName: office.name,
        distanceMeters: Math.round(distance),
      };
    }
  }

  return {
    allowed: false,
    matchedLocationName: closest?.name,
    distanceMeters: closest ? Math.round(closest.distance) : undefined,
    reason: `You are ${closest ? Math.round(closest.distance) : '?'}m away from ${
      closest?.name ?? 'the office'
    }. You must be within the configured radius to mark attendance.`,
  };
};
