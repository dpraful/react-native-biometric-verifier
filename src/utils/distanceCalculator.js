/**
 * Calculates the distance between two geographical points in meters.
 * Uses the Haversine formula.
 *
 * @param {number} lat1 - Latitude of the first point in decimal degrees.
 * @param {number} lng1 - Longitude of the first point in decimal degrees.
 * @param {number} lat2 - Latitude of the second point in decimal degrees.
 * @param {number} lng2 - Longitude of the second point in decimal degrees.
 * @returns {number} Distance in meters.
 */
export const getDistanceInMeters = (lat1, lng1, lat2, lng2) => {
  try {
    const toRad = (value) => (value * Math.PI) / 180;

    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  } catch (error) {
    console.error("Error calculating distance:", error);
    return null;
  }
};
