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

function MapLocationPicker({ onSelect, label, initialPosition, otherMarker, userLocation }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const otherMarkerRef = useRef(null);
  const containerRef = useRef(null);
  const userDotRef = useRef(null);
  const pulseIntervalRef = useRef(null);

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
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !initialPosition) return;
    mapRef.current.setView([initialPosition.lat, initialPosition.lng], DEFAULT_ZOOM);
    mapRef.current.invalidateSize();
    if (markerRef.current) {
      markerRef.current.setLatLng([initialPosition.lat, initialPosition.lng]);
    }
  }, [initialPosition]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocation) {
      if (userDotRef.current) {
        userDotRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        const dot = L.circleMarker([userLocation.lat, userLocation.lng], {
          radius: 8,
          color: '#4285F4',
          fillColor: '#4285F4',
          fillOpacity: 1,
          weight: 2,
          opacity: 1,
        }).addTo(map);
        dot.bindPopup('You are here');
        userDotRef.current = dot;

        let growing = true;
        pulseIntervalRef.current = setInterval(() => {
          const r = dot.getRadius();
          if (growing) {
            dot.setRadius(r + 0.5);
            if (r >= 12) growing = false;
          } else {
            dot.setRadius(r - 0.5);
            if (r <= 8) growing = true;
          }
        }, 100);
      }
    } else if (userDotRef.current) {
      map.removeLayer(userDotRef.current);
      userDotRef.current = null;
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
      }
    }
  }, [userLocation]);

  return (
    <div className="mb-4">
      {label && <p className="text-sm text-text-muted mb-1.5">{label}</p>}
      <div ref={containerRef} className="w-full h-[280px] rounded-sm border-2 border-border overflow-hidden" />
    </div>
  );
}

export default MapLocationPicker;
