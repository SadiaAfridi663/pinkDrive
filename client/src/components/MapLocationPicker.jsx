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

const GREEN_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapLocationPicker({ onSelect, label, initialPosition, otherMarker }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const otherMarkerRef = useRef(null);
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

  useEffect(() => {
    if (!mapRef.current) return;
    if (otherMarker) {
      if (otherMarkerRef.current) {
        otherMarkerRef.current.setLatLng([otherMarker.lat, otherMarker.lng]);
      } else {
        otherMarkerRef.current = L.marker([otherMarker.lat, otherMarker.lng], { icon: GREEN_ICON })
          .addTo(mapRef.current)
          .bindPopup('Pickup');
      }
    } else if (otherMarkerRef.current) {
      mapRef.current.removeLayer(otherMarkerRef.current);
      otherMarkerRef.current = null;
    }
  }, [otherMarker]);

  return (
    <div className="map-picker">
      {label && <p className="map-label">{label}</p>}
      <div ref={containerRef} className="map-container" />
    </div>
  );
}

export default MapLocationPicker;
