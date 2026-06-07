import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import RideRouteMap from '../components/RideRouteMap';
import LocationGate from '../components/LocationGate';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function DriverRidesInner() {
  const [pendingRides, setPendingRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
  const [activePassenger, setActivePassenger] = useState(null);
  const [history, setHistory] = useState([]);
  const [driverLocation, setDriverLocation] = useState(null);
  const [passengerLocation, setPassengerLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { socket } = useSocket();
  const watchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);

  const fetchData = async () => {
    try {
      const [pendingRes, activeRes, historyRes] = await Promise.all([
        rideAPI.getPendingRides().catch(() => ({ data: { data: { rides: [] } } })),
        rideAPI.getActiveRide(),
        rideAPI.getHistory().catch(() => ({ data: { data: { rides: [] } } })),
      ]);
      setPendingRides(pendingRes.data.data.rides);
      const active = activeRes.data.data;
      setActiveRide(active.ride);
      setActiveDriver(active.driver);
      setActivePassenger(active.passenger);
      setHistory(historyRes.data.data.rides.slice(0, 10));
    } catch (err) {
      if (err.response?.status !== 403) {
        setError(err.response?.data?.message || 'Failed to load.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket || !activeRide) return;
    socket.emit('join:ride', activeRide.id);
    return () => {
      socket.emit('leave:ride', activeRide.id);
    };
  }, [socket, activeRide?.id]);

  useEffect(() => {
    if (!socket) return;
    const handler = (loc) => setDriverLocation(loc);
    const statusHandler = (data) => {
      if (data.rideId === activeRide?.id) {
        fetchData();
      }
    };
    socket.on('driver:location', handler);
    socket.on('ride:status', statusHandler);
    return () => {
      socket.off('driver:location', handler);
      socket.off('ride:status', statusHandler);
    };
  }, [socket, activeRide?.id]);

  useEffect(() => {
    if (!socket) return;
    const handler = (loc) => setPassengerLocation(loc);
    socket.on('passenger:location', handler);
    return () => socket.off('passenger:location', handler);
  }, [socket]);

  useEffect(() => {
    if (!activeRide || !['accepted', 'arrived', 'in_progress'].includes(activeRide.status)) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      return;
    }

    const emitLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDriverLocation(loc);
          if (socket?.connected && activeRide) {
            socket.emit('location:update', { rideId: activeRide.id, lat: loc.lat, lng: loc.lng });
          }
          rideAPI.updateDriverLocation(activeRide.id, loc.lat, loc.lng).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    };

    emitLocation();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverLocation(loc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );

    locationIntervalRef.current = setInterval(emitLocation, 5000);

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [activeRide?.id, activeRide?.status, socket?.connected]);

  const handleAccept = async (rideId) => {
    setMessage('');
    setError('');
    try {
      const res = await rideAPI.acceptRide(rideId);
      setMessage(res.data.message);
      fetchData();
      if (navigator.geolocation && socket?.connected) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setDriverLocation(loc);
            socket.emit('location:update', { rideId, lat: loc.lat, lng: loc.lng });
            rideAPI.updateDriverLocation(rideId, loc.lat, loc.lng).catch(() => {});
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept.');
    }
  };

  const handleStatus = async (rideId, status) => {
    setMessage('');
    setError('');
    try {
      const res = await rideAPI.updateStatus(rideId, status);
      setMessage(res.data.message);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update.');
    }
  };

  const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const badgeClass = (status) => {
    const base = 'inline-block text-xs font-semibold uppercase tracking-[0.05em] px-2 py-1 rounded';
    const colors = {
      approved: 'bg-[#e8f5e9] text-success',
      rejected: 'bg-[#ffebee] text-error',
      pending: 'bg-[#fff8e1] text-warning',
      accepted: 'bg-[#e3f2fd] text-[#1565c0]',
      arrived: 'bg-[#e3f2fd] text-[#1565c0]',
      in_progress: 'bg-[#f3e5f5] text-[#7b1fa2]',
      completed: 'bg-[#e8f5e9] text-success',
      cancelled: 'bg-[#f5f5f5] text-text-light',
    };
    return `${base} ${colors[status] || colors.pending}`;
  };

  const activePickup = useMemo(() => activeRide ? { lat: activeRide.pickupLat, lng: activeRide.pickupLng } : null, [activeRide?.pickupLat, activeRide?.pickupLng]);
  const activeDropoff = useMemo(() => activeRide ? { lat: activeRide.dropoffLat, lng: activeRide.dropoffLng } : null, [activeRide?.dropoffLat, activeRide?.dropoffLng]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Rides</h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">Accept and manage ride requests</p>
      </div>

      {error && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{error}</p>}
      {message && <p className="bg-[#f1faf1] text-success border border-[#c8e6c9] px-3.5 py-2.5 rounded-sm text-sm mb-2">{message}</p>}

      {activeRide && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-plum mb-3 tracking-[-0.01em] m-0">Current Ride</h3>
          <div className="bg-white border border-border rounded p-5">
            <div className="mb-2">
              <span className={badgeClass(activeRide.status)}>{activeRide.status}</span>
            </div>

            {activePassenger && (
              <div className="flex items-center gap-3 mb-3 p-2.5 bg-off-white rounded-sm">
                {activePassenger.selfiePath ? (
                  <img
                    src={`${API_URL}/${activePassenger.selfiePath.replace(/\\/g, '/')}`}
                    alt={activePassenger.name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-border"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-pink-subtle flex items-center justify-center text-base text-pink">
                    {activePassenger.name?.[0] || 'P'}
                  </div>
                )}
                <div>
                  <p className="m-0 font-semibold text-plum text-[0.95rem]">{activePassenger.name}</p>
                </div>
              </div>
            )}

            {['accepted', 'arrived', 'in_progress'].includes(activeRide.status) && (
              <div className="mb-4 rounded-sm overflow-hidden border-2 border-border">
                <RideRouteMap
                  pickup={activePickup}
                  dropoff={activeDropoff}
                  driverLocation={driverLocation}
                  passengerLocation={passengerLocation}
                  height="220px"
                />
              </div>
            )}

            <div className="flex flex-col gap-2 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Passenger</span>
                <span className="font-medium text-plum font-mono">{activePassenger?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Pickup</span>
                <span className="font-medium text-plum font-mono">{activeRide.pickupAddress || `${activeRide.pickupLat?.toFixed(4)}, ${activeRide.pickupLng?.toFixed(4)}`}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Drop-off</span>
                <span className="font-medium text-plum font-mono">{activeRide.dropoffAddress || `${activeRide.dropoffLat?.toFixed(4)}, ${activeRide.dropoffLng?.toFixed(4)}`}</span>
              </div>
              {activeRide.distance && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-muted">Distance</span>
                  <span className="font-medium text-plum font-mono">{activeRide.distance} km</span>
                </div>
              )}
              {activeRide.fare > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-muted">Fare</span>
                  <span className="font-medium text-plum font-mono font-bold">{activeRide.fare} PKR</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              {activeRide.status === 'accepted' && (() => {
                const distToPickup = driverLocation
                  ? Math.round(haversineDistance(driverLocation.lat, driverLocation.lng, activeRide.pickupLat, activeRide.pickupLng) * 1000)
                  : null;
                const isNear = distToPickup !== null && distToPickup <= 50;
                return (
                  <div className="w-full">
                    {distToPickup !== null && (
                      <p className="m-0 mb-1.5 text-xs text-text-muted text-center">
                        {isNear ? 'Arrived at pickup' : `${distToPickup}m from pickup`}
                      </p>
                    )}
                    <button
                      className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none w-full"
                      style={{ opacity: isNear ? 1 : 0.5 }}
                      disabled={!isNear}
                      onClick={() => handleStatus(activeRide.id, 'arrived')}
                    >
                      {isNear ? 'Mark Arrived' : `${distToPickup !== null ? distToPickup : '...'}m from pickup`}
                    </button>
                  </div>
                );
              })()}
              {activeRide.status === 'arrived' && (
                <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={() => handleStatus(activeRide.id, 'in_progress')}>
                  Start Ride
                </button>
              )}
              {activeRide.status === 'in_progress' && (
                <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={() => handleStatus(activeRide.id, 'completed')}>
                  Complete Ride
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-display text-base font-semibold text-plum mb-3 tracking-[-0.01em] m-0">Pending Requests ({pendingRides.length})</h3>

        {pendingRides.length === 0 ? (
          <div className="text-center p-12 mt-0">
            <div className="text-4xl mb-2">&#128663;</div>
            <h3 className="font-display text-[1.2rem] font-semibold text-plum m-0 mb-1">No ride requests</h3>
            <p className="text-sm text-text-muted m-0">Waiting for passengers to request rides.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingRides.map((ride) => (
              <div key={ride.id} className="bg-white border border-border rounded p-5">
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Passenger</span>
                    <span className="font-medium text-plum font-mono">{ride.passenger?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Pickup</span>
                    <span className="font-medium text-plum font-mono">{ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Drop-off</span>
                    <span className="font-medium text-plum font-mono">{ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Distance</span>
                    <span className="font-medium text-plum font-mono">{ride.distance ? `${ride.distance} km` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Fare</span>
                    <span className="font-medium text-plum font-mono font-bold">{ride.fare ? `${ride.fare} PKR` : 'N/A'}</span>
                  </div>
                </div>
                <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none w-full mt-2" onClick={() => handleAccept(ride.id)}>
                  Accept Ride
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-plum mb-3 tracking-[-0.01em] m-0">Recent Rides</h3>
          <div className="flex flex-col gap-1.5">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-white border border-border rounded-sm cursor-pointer" onClick={() => navigate(`/ride/${r.id}`)}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-plum">
                    {r.passenger ? `${r.passenger.name} · ` : ''}{r.pickupAddress || `${r.pickupLat?.toFixed(2)}, ${r.pickupLng?.toFixed(2)}`} &rarr; {r.dropoffAddress || `${r.dropoffLat?.toFixed(2)}, ${r.dropoffLng?.toFixed(2)}`}
                  </span>
                  <span className="text-xs text-text-light">
                    {r.distance ? `${r.distance} km · ` : ''}{r.fare ? `${r.fare} PKR · ` : ''}{new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={badgeClass(r.status)}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DriverRides() {
  return (
    <LocationGate>
      <DriverRidesInner />
    </LocationGate>
  );
}

export default DriverRides;
