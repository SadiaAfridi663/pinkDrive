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
    const base = 'badge';
    const colors = {
      approved: 'badge-success',
      rejected: 'badge-error',
      pending: 'badge-warning',
      accepted: 'badge-info',
      arrived: 'badge-info',
      in_progress: 'bg-[#f3e5f5] text-[#7b1fa2]',
      completed: 'badge-success',
      cancelled: 'badge-neutral',
    };
    return `${base} ${colors[status] || colors.pending}`;
  };

  const activePickup = useMemo(() => activeRide ? { lat: activeRide.pickupLat, lng: activeRide.pickupLng } : null, [activeRide?.pickupLat, activeRide?.pickupLng]);
  const activeDropoff = useMemo(() => activeRide ? { lat: activeRide.dropoffLat, lng: activeRide.dropoffLng } : null, [activeRide?.dropoffLat, activeRide?.dropoffLng]);

  if (loading) return <div className="page"><div className="space-y-3"><div className="loading-skeleton h-8 w-1/3" /><div className="loading-skeleton h-4 w-2/3" /><div className="loading-skeleton h-32" /></div></div>;

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Rides</h1>
        <p>Accept and manage ride requests</p>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {message && <p className="msg msg-success">{message}</p>}

      {activeRide && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Current Ride</h3>
          <div className="card p-5">
            <div className="mb-2">
              <span className={badgeClass(activeRide.status)}>{activeRide.status}</span>
            </div>

            {activePassenger && (
              <div className="flex items-center gap-3 mb-3 p-2.5 bg-ivory rounded-sm">
                {activePassenger.selfiePath ? (
                  <img
                    src={`${API_URL}/${activePassenger.selfiePath.replace(/\\/g, '/')}`}
                    alt={activePassenger.name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-border"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-coral-light flex items-center justify-center text-base text-coral">
                    {activePassenger.name?.[0] || 'P'}
                  </div>
                )}
                <div>
                  <p className="m-0 font-semibold text-navy text-[0.95rem]">{activePassenger.name}</p>
                </div>
              </div>
            )}

            {activeRide.status !== 'cancelled' && (
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
                <span className="text-stone">Passenger</span>
                <span className="font-medium text-navy font-mono">{activePassenger?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone">Pickup</span>
                <span className="font-medium text-navy font-mono">{activeRide.pickupAddress || `${activeRide.pickupLat?.toFixed(4)}, ${activeRide.pickupLng?.toFixed(4)}`}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone">Drop-off</span>
                <span className="font-medium text-navy font-mono">{activeRide.dropoffAddress || `${activeRide.dropoffLat?.toFixed(4)}, ${activeRide.dropoffLng?.toFixed(4)}`}</span>
              </div>
              {activeRide.distance && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone">Distance</span>
                  <span className="font-medium text-navy font-mono">{activeRide.distance} km</span>
                </div>
              )}
              {activeRide.fare > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone">Fare</span>
                  <span className="font-medium text-navy font-mono font-bold">{activeRide.fare} PKR</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              {activeRide.status === 'accepted' && (() => {
                const distToPickup = driverLocation
                  ? Math.round(haversineDistance(driverLocation.lat, driverLocation.lng, activeRide.pickupLat, activeRide.pickupLng) * 1000)
                  : null;
                 const isNear = distToPickup !== null && distToPickup <= 200;
                 return (
                   <div className="w-full">
                    {distToPickup !== null && (
                      <p className="m-0 mb-1.5 text-xs text-stone text-center">
                        {isNear ? 'Arrived at pickup' : `${distToPickup}m from pickup`}
                      </p>
                    )}
                    <button
                      className="btn btn-primary w-full"
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
                <button className="btn btn-primary flex-1" onClick={() => handleStatus(activeRide.id, 'in_progress')}>
                  Start Ride
                </button>
              )}
              {activeRide.status === 'in_progress' && (
                <button className="btn btn-primary flex-1" onClick={() => handleStatus(activeRide.id, 'completed')}>
                  Complete Ride
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Pending Requests ({pendingRides.length})</h3>

        {pendingRides.length === 0 ? (
          <div className="text-center p-12 mt-0">
            <div className="text-4xl mb-2">&#128663;</div>
            <h3 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-1">No ride requests</h3>
            <p className="text-sm text-stone m-0">Waiting for passengers to request rides.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingRides.map((ride) => (
              <div key={ride.id} className="card p-5">
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone">Passenger</span>
                    <span className="font-medium text-navy font-mono">{ride.passenger?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone">Pickup</span>
                    <span className="font-medium text-navy font-mono">{ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone">Drop-off</span>
                    <span className="font-medium text-navy font-mono">{ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone">Distance</span>
                    <span className="font-medium text-navy font-mono">{ride.distance ? `${ride.distance} km` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone">Fare</span>
                    <span className="font-medium text-navy font-mono font-bold">{ride.fare ? `${ride.fare} PKR` : 'N/A'}</span>
                  </div>
                </div>
                <button className="btn btn-primary w-full mt-2" onClick={() => handleAccept(ride.id)}>
                  Accept Ride
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Recent Rides</h3>
          <div className="flex flex-col gap-1.5">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 card-list card-list-hover" onClick={() => navigate(`/ride/${r.id}`)}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-navy">
                    {r.passenger ? `${r.passenger.name} · ` : ''}{r.pickupAddress || `${r.pickupLat?.toFixed(2)}, ${r.pickupLng?.toFixed(2)}`} &rarr; {r.dropoffAddress || `${r.dropoffLat?.toFixed(2)}, ${r.dropoffLng?.toFixed(2)}`}
                  </span>
                  <span className="text-xs text-stone-light">
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
