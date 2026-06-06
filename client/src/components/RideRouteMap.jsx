import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const RED_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const BLUE_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const ORANGE_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const CAR_ICON = L.divIcon({
  html: '<div style="font-size:1.4rem;transform:rotate(-45deg)">🚗</div>',
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const ROUTE_COLOR = '#e9408b';
const ROUTE_WEIGHT = 5;

function RideRouteMap({ pickup, dropoff, driverLocation, passengerLocation, nearbyDrivers, height, className }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const passengerMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const nearbyMarkersRef = useRef([]);

  const fetchRoute = async (map, p1, p2) => {
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?geometries=geojson&overview=full`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.[0]) return;
      const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      routeLayerRef.current = L.polyline(coords, {
        color: ROUTE_COLOR,
        weight: ROUTE_WEIGHT,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      const bounds = L.latLngBounds([coords[0], coords[coords.length - 1]]);
      if (p1 && p2) bounds.extend([p1.lat, p1.lng]).extend([p2.lat, p2.lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch {
      // OSRM unavailable — skip route
    }
  };

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const points = [];
    if (pickup) points.push([pickup.lat, pickup.lng]);
    if (dropoff) points.push([dropoff.lat, dropoff.lng]);
    if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);
    if (passengerLocation) points.push([passengerLocation.lat, passengerLocation.lng]);
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50] });
  };

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: pickup ? [pickup.lat, pickup.lng] : [31.5204, 74.3587],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      driverMarkerRef.current = null;
      passengerMarkerRef.current = null;
      routeLayerRef.current = null;
      nearbyMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pickup) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
      } else {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon: GREEN_ICON })
          .addTo(map).bindPopup('Pickup');
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    if (dropoff) {
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setLatLng([dropoff.lat, dropoff.lng]);
      } else {
        dropoffMarkerRef.current = L.marker([dropoff.lat, dropoff.lng], { icon: RED_ICON })
          .addTo(map).bindPopup('Drop-off');
      }
    } else if (dropoffMarkerRef.current) {
      map.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }

    if (pickup && dropoff) {
      fetchRoute(map, pickup, dropoff);
    }
  }, [pickup, dropoff]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (driverLocation) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
      } else {
        driverMarkerRef.current = L.marker([driverLocation.lat, driverLocation.lng], { icon: BLUE_ICON })
          .addTo(map).bindPopup('Driver');
      }
      if (pickup && dropoff) fitAll();
    } else if (driverMarkerRef.current) {
      map.removeLayer(driverMarkerRef.current);
      driverMarkerRef.current = null;
    }
  }, [driverLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (passengerLocation) {
      if (passengerMarkerRef.current) {
        passengerMarkerRef.current.setLatLng([passengerLocation.lat, passengerLocation.lng]);
      } else {
        passengerMarkerRef.current = L.marker([passengerLocation.lat, passengerLocation.lng], { icon: ORANGE_ICON })
          .addTo(map).bindPopup('You');
      }
      if (pickup && dropoff && driverLocation) fitAll();
    } else if (passengerMarkerRef.current) {
      map.removeLayer(passengerMarkerRef.current);
      passengerMarkerRef.current = null;
    }
  }, [passengerLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of nearbyMarkersRef.current) map.removeLayer(m);
    nearbyMarkersRef.current = [];

    if (nearbyDrivers) {
      for (const d of nearbyDrivers) {
        const m = L.marker([d.lat, d.lng], { icon: CAR_ICON }).addTo(map).bindPopup(d.name);
        nearbyMarkersRef.current.push(m);
      }
    }
  }, [nearbyDrivers]);

  return (
    <div
      ref={containerRef}
      className={`map-container ${className || ''}`}
      style={height ? { height } : undefined}
    />
  );
}

export default RideRouteMap;
