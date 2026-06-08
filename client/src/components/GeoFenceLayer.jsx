import { useEffect, useRef } from 'react';
import L from 'leaflet';

function GeoFenceLayer({ map, areas }) {
  const layersRef = useRef([]);

  useEffect(() => {
    if (!map || !areas) return;

    for (const layer of layersRef.current) map.removeLayer(layer);
    layersRef.current = [];

    for (const area of areas) {
      if (!area.coordinates || area.coordinates.length < 3) continue;
      const coords = area.coordinates.map(([lat, lng]) => [lat, lng]);
      const polygon = L.polygon(coords, {
        color: area.color || '#e91e8c',
        weight: 2,
        opacity: 0.8,
        fillColor: area.color || '#e91e8c',
        fillOpacity: 0.15,
      }).addTo(map);

      polygon.bindPopup(`<strong>${area.name}</strong>`);
      layersRef.current.push(polygon);
    }

    return () => {
      for (const layer of layersRef.current) map.removeLayer(layer);
      layersRef.current = [];
    };
  }, [map, areas]);

  return null;
}

export default GeoFenceLayer;
