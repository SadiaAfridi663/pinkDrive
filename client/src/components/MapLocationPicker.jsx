import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [31.5204, 74.3587];
const DEFAULT_ZOOM = 12;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapLocationPicker({ onSelect, label, initialPosition }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: initialPosition || DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const handlePosition = (latlng) => {
      if (!markerRef.current) {
        markerRef.current = L.marker(latlng, { draggable: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current.getLatLng();
          onSelect({ lat: pos.lat, lng: pos.lng });
        });
      } else {
        markerRef.current.setLatLng(latlng);
      }
      onSelect({ lat: latlng.lat, lng: latlng.lng });
    };

    if (initialPosition) {
      handlePosition(initialPosition);
    }

    map.on('click', (e) => handlePosition(e.latlng));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="map-picker">
      {label && <p className="map-label">{label}</p>}
      <div ref={containerRef} className="map-container" />
    </div>
  );
}

export default MapLocationPicker;
