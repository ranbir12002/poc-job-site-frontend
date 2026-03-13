import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates the Haversine distance between two sets of coordinates.
 * Returns the distance in meters.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates the cumulative total distance of an array of points.
 */
export function calculateTotalDistance(points: { lat: number, lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

/**
 * Ray-casting algorithm to check if a point is inside a polygon.
 * Returns true if the point (lat, lng) is inside the polygon defined by the array of vertices.
 */
export function isPointInsidePolygon(
  lat: number,
  lng: number,
  polygon: { lat: number; lng: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculates the shortest distance (in meters) from a point to a line segment.
 * Uses projection to find the closest point on the segment, then Haversine for distance.
 */
export function distanceToSegment(
  lat: number,
  lng: number,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dx = lat2 - lat1;
  const dy = lng2 - lng1;
  
  if (dx === 0 && dy === 0) {
    // Segment is a single point
    return calculateDistance(lat, lng, lat1, lng1);
  }

  // Project point onto the segment, clamped to [0, 1]
  let t = ((lat - lat1) * dx + (lng - lng1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const closestLat = lat1 + t * dx;
  const closestLng = lng1 + t * dy;

  return calculateDistance(lat, lng, closestLat, closestLng);
}

/**
 * Calculates the shortest distance from a point to any segment in a polyline.
 */
function distanceToPolyline(
  lat: number,
  lng: number,
  points: { lat: number; lng: number }[]
): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(
      lat, lng,
      points[i].lat, points[i].lng,
      points[i + 1].lat, points[i + 1].lng
    );
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Checks if a given location is within a site's geofenced area.
 * - For closed polygons: returns true if the user is inside the polygon OR within maxDistance of any edge.
 * - For open paths: returns true if the user is within maxDistance of any path segment.
 */
export function isLocationNearSite(
  currentLocation: [number, number],
  sitePoints: { lat: number, lng: number }[],
  maxDistanceMeters: number = 50,
  isClosed: boolean = true
): boolean {
  if (!sitePoints || sitePoints.length === 0) return true;

  const [userLat, userLng] = currentLocation;

  // For closed polygons with 3+ points, check if user is inside the polygon
  if (isClosed && sitePoints.length >= 3) {
    if (isPointInsidePolygon(userLat, userLng, sitePoints)) {
      return true;
    }
  }

  // Check distance to each segment (works for both polygon edges and path segments)
  if (sitePoints.length >= 2) {
    const polylinePoints = isClosed
      ? [...sitePoints, sitePoints[0]] // close the loop for polygon edge check
      : sitePoints;
    
    const dist = distanceToPolyline(userLat, userLng, polylinePoints);
    if (dist <= maxDistanceMeters) {
      return true;
    }
  } else {
    // Single point — just check distance to that point
    const dist = calculateDistance(userLat, userLng, sitePoints[0].lat, sitePoints[0].lng);
    if (dist <= maxDistanceMeters) {
      return true;
    }
  }

  return false;
}
