import L from 'leaflet';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function resolvePhotoUrl(photo) {
  if (!photo) return null;
  if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) return photo;
  return `${API_URL}/${photo.replace(/\\/g, '/')}`;
}

export function createPassengerMarker({ lat, lng, passengerPhoto, photoUrl, name, size = 36, borderColor = '#e9408b' }) {
  const url = photoUrl || resolvePhotoUrl(passengerPhoto);
  const cacheBuster = url ? `?cb=${Date.now()}` : '';
  const initial = (name || 'P')[0].toUpperCase();

  const html = url
    ? `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${borderColor};overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.35);background:white;">
        <img src="${url}${cacheBuster}" style="width:100%;height:100%;object-fit:cover;display:block;"
             onerror="this.style.display='none';this.parentElement.textContent='${initial}';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center';this.parentElement.style.background='#FCE4EC';this.parentElement.style.color='#E91E8C';this.parentElement.style.fontWeight='bold';this.parentElement.style.fontSize='${Math.round(size * 0.44)}px'" />
      </div>`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${borderColor};display:flex;align-items:center;justify-content:center;background:#FCE4EC;color:#E91E8C;font-weight:bold;font-size:${Math.round(size * 0.44)}px;box-shadow:0 2px 8px rgba(0,0,0,0.35);">${initial}</div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function createDriverMarker({ lat, lng, driverPhoto, photoUrl, name, size = 36 }) {
  return createPassengerMarker({
    lat, lng,
    passengerPhoto: driverPhoto,
    photoUrl,
    name: name || 'Driver',
    size,
    borderColor: '#4285F4',
  });
}
