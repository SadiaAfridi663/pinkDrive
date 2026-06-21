const logger = require('./logger');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PinkDrive/1.0' },
    });

    if (!res.ok) {
      logger.warn(`Nominatim returned ${res.status} for ${lat},${lng}`);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    const data = await res.json();
    if (data && data.display_name) {
      return data.display_name;
    }

    logger.warn('Nominatim response missing display_name', { lat, lng });
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    logger.warn('Reverse geocode failed', { lat, lng, error: err.message });
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

async function reverseGeocodeBoth(pickupLat, pickupLng, dropoffLat, dropoffLng) {
  const pickup = await reverseGeocode(pickupLat, pickupLng);
  // Nominatim rate limit: 1 req/sec — delay before second call
  await new Promise((r) => setTimeout(r, 1100));
  const dropoff = await reverseGeocode(dropoffLat, dropoffLng);
  return [pickup, dropoff];
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function fileToUrl(filePath) {
  if (!filePath) return null;
  let normalized = typeof filePath === 'string' ? filePath : String(filePath);
  normalized = normalized.replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  if (idx === -1) return normalized;
  return normalized.substring(idx);
}

function isPointInPolygon(lat, lng, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    if ((latI > lat) !== (latJ > lat) &&
        lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI) {
      inside = !inside;
    }
  }
  return inside;
}

async function hydrateRideAddresses(ride) {
  if (!ride) return ride;
  try {
    if (!ride.pickupAddress && ride.pickupLat != null) {
      ride.pickupAddress = await reverseGeocode(ride.pickupLat, ride.pickupLng);
      if (ride.pickupAddress && typeof ride.save === 'function') await ride.save();
    }
    if (!ride.dropoffAddress && ride.dropoffLat != null) {
      ride.dropoffAddress = await reverseGeocode(ride.dropoffLat, ride.dropoffLng);
      if (ride.dropoffAddress && typeof ride.save === 'function') await ride.save();
    }
  } catch { /* best-effort */ }
  return ride;
}

module.exports = { reverseGeocode, reverseGeocodeBoth, haversineDistance, fileToUrl, isPointInPolygon, hydrateRideAddresses };
