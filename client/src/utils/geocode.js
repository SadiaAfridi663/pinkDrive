const CACHE = new Map();

export async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (CACHE.has(key)) return CACHE.get(key);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const addr = data?.display_name || data?.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    CACHE.set(key, addr);
    return addr;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
