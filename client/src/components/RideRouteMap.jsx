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

const PURPLE_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const CAR_ICON = L.divIcon({
  html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(-45deg)"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2-4c-.3-.6-1-1-1.7-1H9.7c-.7 0-1.4.4-1.7 1L6 10l-2.5.1C2.7 10.3 2 11.1 2 12v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const ROUTE_COLOR = '#e9408b';
const ROUTE_WEIGHT = 5;

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function RideRouteMap({ pickup, dropoff, driverLocation, passengerLocation, nearbyDrivers, secondaryPickup, secondaryDropoff, secondaryColor, height, className, passengerMarkers }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const passengerMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const nearbyMarkersRef = useRef([]);
  const secondaryPickupMarkerRef = useRef(null);
  const secondaryDropoffMarkerRef = useRef(null);
  const secondaryRouteLayerRef = useRef(null);
  const passengerMarkersRef = useRef([]);

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
      if (mapRef.current !== map) return;
      const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      routeLayerRef.current = L.polyline(coords, {
        color: ROUTE_COLOR,
        weight: ROUTE_WEIGHT,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      fitAll();
    } catch (err) {
      if (mapRef.current === map) {
        console.warn('[RideRouteMap] OSRM route failed:', err);
      }
    }
  };

  const fetchSecondaryRoute = async (map, p1, p2) => {
    if (secondaryRouteLayerRef.current) {
      map.removeLayer(secondaryRouteLayerRef.current);
      secondaryRouteLayerRef.current = null;
    }
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?geometries=geojson&overview=full`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.[0]) return;
      if (mapRef.current !== map) return;
      const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      secondaryRouteLayerRef.current = L.polyline(coords, {
        color: secondaryColor || '#f59e0b',
        weight: 4,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '10, 8',
      }).addTo(map);
      fitAll();
    } catch (err) {
      if (mapRef.current === map) {
        console.warn('[RideRouteMap] Secondary OSRM route failed:', err);
      }
    }
  };

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const points = [];
    if (pickup) points.push([pickup.lat, pickup.lng]);
    if (dropoff) points.push([dropoff.lat, dropoff.lng]);
    if (secondaryPickup) points.push([secondaryPickup.lat, secondaryPickup.lng]);
    if (secondaryDropoff) points.push([secondaryDropoff.lat, secondaryDropoff.lng]);
    if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);
    if (passengerLocation) points.push([passengerLocation.lat, passengerLocation.lng]);
    if (passengerMarkers) {
      for (const pm of passengerMarkers) {
        points.push([pm.lat, pm.lng]);
      }
    }
    if (points.length < 2) {
      if (points.length === 1) {
        map.setView(points[0], 14);
      }
      return;
    }
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

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      driverMarkerRef.current = null;
      passengerMarkerRef.current = null;
      routeLayerRef.current = null;
      nearbyMarkersRef.current = [];
      secondaryPickupMarkerRef.current = null;
      secondaryDropoffMarkerRef.current = null;
      secondaryRouteLayerRef.current = null;
      passengerMarkersRef.current = [];
      if (containerRef.current) {
        delete containerRef.current._leaflet_id;
      }
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

    if (secondaryPickup) {
      if (secondaryPickupMarkerRef.current) {
        secondaryPickupMarkerRef.current.setLatLng([secondaryPickup.lat, secondaryPickup.lng]);
      } else {
        secondaryPickupMarkerRef.current = L.marker([secondaryPickup.lat, secondaryPickup.lng], { icon: PURPLE_ICON })
          .addTo(map).bindPopup('Your Pickup');
      }
    } else if (secondaryPickupMarkerRef.current) {
      map.removeLayer(secondaryPickupMarkerRef.current);
      secondaryPickupMarkerRef.current = null;
    }

    if (secondaryDropoff) {
      if (secondaryDropoffMarkerRef.current) {
        secondaryDropoffMarkerRef.current.setLatLng([secondaryDropoff.lat, secondaryDropoff.lng]);
      } else {
        const AMBER_ICON = new L.Icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        secondaryDropoffMarkerRef.current = L.marker([secondaryDropoff.lat, secondaryDropoff.lng], { icon: AMBER_ICON })
          .addTo(map).bindPopup('Your Drop-off');
      }
    } else if (secondaryDropoffMarkerRef.current) {
      map.removeLayer(secondaryDropoffMarkerRef.current);
      secondaryDropoffMarkerRef.current = null;
    }

    if (secondaryPickup && secondaryDropoff) {
      fetchSecondaryRoute(map, secondaryPickup, secondaryDropoff);
    }
  }, [secondaryPickup, secondaryDropoff]);

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
      fitAll();
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
      fitAll();
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of passengerMarkersRef.current) map.removeLayer(m);
    passengerMarkersRef.current = [];

    if (passengerMarkers) {
      for (const pm of passengerMarkers) {
        const photoUrl = pm.photoUrl || (pm.passengerPhoto ? `${API_URL}/${pm.passengerPhoto.replace(/\\/g, '/')}` : null);
        const initial = (pm.name || pm.passengerName || 'P')[0];
        const html = photoUrl
          ? `<div style="width:36px;height:36px;border-radius:50%;border:3px solid #e9408b;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.3);background:white;"><img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.textContent='${initial}'" /></div>`
          : `<div style="width:36px;height:36px;border-radius:50%;border:3px solid #e9408b;display:flex;align-items:center;justify-content:center;background:#FCE4EC;color:#E91E8C;font-weight:bold;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${initial}</div>`;
        const icon = L.divIcon({ html, className: '', iconSize: [36, 36], iconAnchor: [18, 18] });
        const m = L.marker([pm.lat, pm.lng], { icon })
          .addTo(map)
          .bindPopup(pm.name || pm.passengerName || 'Passenger');
        passengerMarkersRef.current.push(m);
      }
      fitAll();
    }
  }, [passengerMarkers]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-[280px] rounded-sm border-2 border-border overflow-hidden ${className || ''}`}
      style={height ? { height } : undefined}
    />
  );
}

export default RideRouteMap;
