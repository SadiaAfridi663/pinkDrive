import { useState, useEffect, useRef } from 'react';
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

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Rides</h1>
        <p className="page-subtitle">Accept and manage ride requests</p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      {activeRide && (
        <div className="section">
          <h3 className="section-title">Current Ride</h3>
          <div className="ride-card">
            <div className="ride-card-top">
              <span className={`badge badge--${activeRide.status}`}>{activeRide.status}</span>
            </div>

            {activePassenger && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.6rem', background: 'var(--off-white)', borderRadius: 'var(--radius-sm)' }}>
                {activePassenger.selfiePath ? (
                  <img
                    src={`${API_URL}/${activePassenger.selfiePath.replace(/\\/g, '/')}`}
                    alt={activePassenger.name}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--pink-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'var(--pink)' }}>
                    {activePassenger.name?.[0] || 'P'}
                  </div>
                )}
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--plum)', fontSize: '0.95rem' }}>{activePassenger.name}</p>
                </div>
              </div>
            )}

            {['accepted', 'arrived', 'in_progress'].includes(activeRide.status) && (
              <div style={{ marginBottom: '1rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                <RideRouteMap
                  pickup={{ lat: activeRide.pickupLat, lng: activeRide.pickupLng }}
                  dropoff={{ lat: activeRide.dropoffLat, lng: activeRide.dropoffLng }}
                  driverLocation={driverLocation}
                  passengerLocation={passengerLocation}
                  height="220px"
                />
              </div>
            )}

            <div className="ride-card-details">
              <div className="ride-detail">
                <span className="ride-detail-label">Passenger</span>
                <span className="ride-detail-value">{activePassenger?.name || 'Unknown'}</span>
              </div>
              <div className="ride-detail">
                <span className="ride-detail-label">Pickup</span>
                <span className="ride-detail-value">{activeRide.pickupAddress || `${activeRide.pickupLat?.toFixed(4)}, ${activeRide.pickupLng?.toFixed(4)}`}</span>
              </div>
              <div className="ride-detail">
                <span className="ride-detail-label">Drop-off</span>
                <span className="ride-detail-value">{activeRide.dropoffAddress || `${activeRide.dropoffLat?.toFixed(4)}, ${activeRide.dropoffLng?.toFixed(4)}`}</span>
              </div>
              {activeRide.distance && (
                <div className="ride-detail">
                  <span className="ride-detail-label">Distance</span>
                  <span className="ride-detail-value">{activeRide.distance} km</span>
                </div>
              )}
              {activeRide.fare > 0 && (
                <div className="ride-detail">
                  <span className="ride-detail-label">Fare</span>
                  <span className="ride-detail-value" style={{ fontWeight: 700 }}>{activeRide.fare} PKR</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              {activeRide.status === 'accepted' && (() => {
                const distToPickup = driverLocation
                  ? Math.round(haversineDistance(driverLocation.lat, driverLocation.lng, activeRide.pickupLat, activeRide.pickupLng) * 1000)
                  : null;
                const isNear = distToPickup !== null && distToPickup <= 50;
                return (
                  <div style={{ width: '100%' }}>
                    {distToPickup !== null && (
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {isNear
                          ? 'Arrived at pickup'
                          : `${distToPickup}m from pickup`}
                      </p>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, width: '100%', opacity: isNear ? 1 : 0.5 }}
                      disabled={!isNear}
                      onClick={() => handleStatus(activeRide.id, 'arrived')}
                    >
                      {isNear ? 'Mark Arrived' : `${distToPickup !== null ? distToPickup : '...'}m from pickup`}
                    </button>
                  </div>
                );
              })()}
              {activeRide.status === 'arrived' && (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleStatus(activeRide.id, 'in_progress')}>
                  Start Ride
                </button>
              )}
              {activeRide.status === 'in_progress' && (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleStatus(activeRide.id, 'completed')}>
                  Complete Ride
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="section">
        <h3 className="section-title">Pending Requests ({pendingRides.length})</h3>

        {pendingRides.length === 0 ? (
          <div className="empty-section" style={{ marginTop: 0 }}>
            <div className="empty-icon">🚗</div>
            <h3>No ride requests</h3>
            <p>Waiting for passengers to request rides.</p>
          </div>
        ) : (
          <div className="ride-list">
            {pendingRides.map((ride) => (
              <div key={ride.id} className="ride-card">
                <div className="ride-card-details">
                  <div className="ride-detail">
                    <span className="ride-detail-label">Passenger</span>
                    <span className="ride-detail-value">{ride.passenger?.name || 'Unknown'}</span>
                  </div>
                  <div className="ride-detail">
                    <span className="ride-detail-label">Pickup</span>
                    <span className="ride-detail-value">{ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}</span>
                  </div>
                  <div className="ride-detail">
                    <span className="ride-detail-label">Drop-off</span>
                    <span className="ride-detail-value">{ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}</span>
                  </div>
                  <div className="ride-detail">
                    <span className="ride-detail-label">Distance</span>
                    <span className="ride-detail-value">{ride.distance ? `${ride.distance} km` : 'N/A'}</span>
                  </div>
                  <div className="ride-detail">
                    <span className="ride-detail-label">Fare</span>
                    <span className="ride-detail-value" style={{ fontWeight: 700 }}>{ride.fare ? `${ride.fare} PKR` : 'N/A'}</span>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => handleAccept(ride.id)}>
                  Accept Ride
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="section">
          <h3 className="section-title">Recent Rides</h3>
          <div className="history-list">
            {history.map((r) => (
              <div key={r.id} className="history-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/ride/${r.id}`)}>
                <div className="history-row-left">
                  <span className="history-route">
                    {r.passenger ? `${r.passenger.name} · ` : ''}{r.pickupAddress || `${r.pickupLat?.toFixed(2)}, ${r.pickupLng?.toFixed(2)}`} &rarr; {r.dropoffAddress || `${r.dropoffLat?.toFixed(2)}, ${r.dropoffLng?.toFixed(2)}`}
                  </span>
                  <span className="history-date">
                    {r.distance ? `${r.distance} km · ` : ''}{r.fare ? `${r.fare} PKR · ` : ''}{new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={`badge badge--${r.status}`}>{r.status}</span>
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
