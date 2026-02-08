/* ── Distance Calculation Utilities ── */

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters
 */
export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convert meters to a human-readable travel info string.
 * Under 1km → walking estimate, over 1km → driving estimate.
 * @param {number} meters
 * @returns {{ label: string, mode: "walk" | "drive", minutes: number, distanceText: string }}
 */
export function getTravelInfo(meters) {
  if (meters <= 0) return { label: "", mode: "walk", minutes: 0, distanceText: "" };

  const distanceText =
    meters < 1000
      ? `${Math.round(meters)}m`
      : `${(meters / 1000).toFixed(1)}km`;

  if (meters <= 1000) {
    // Walking: ~80m/min
    const minutes = Math.max(1, Math.round(meters / 80));
    return {
      label: `도보 약 ${minutes}분 · ${distanceText}`,
      mode: "walk",
      minutes,
      distanceText,
    };
  }

  // Driving: ~500m/min (urban)
  const minutes = Math.max(1, Math.round(meters / 500));
  return {
    label: `차량 약 ${minutes}분 · ${distanceText}`,
    mode: "drive",
    minutes,
    distanceText,
  };
}

/**
 * Get Google Maps directions URL between two locations.
 * @param {string} originQuery - origin place name or address
 * @param {string} destQuery - destination place name or address
 * @returns {string} Google Maps URL
 */
export function getDirectionsUrl(originQuery, destQuery) {
  const o = encodeURIComponent(originQuery);
  const d = encodeURIComponent(destQuery);
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}`;
}
