import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import RideRouteMap from '../components/RideRouteMap';
import useGeolocation from '../hooks/useGeolocation';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function ActiveRide() {
  const [ride, setRide] = useState(null);
  const [driver, setDriver] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const { position, isGranted, startWatching } = useGeolocation();
  const navigate = useNavigate();
  const watchStartedRef = useRef(false);

  const fetchRide = useCallback(async () => {
    try {
      const res = await rideAPI.getActiveRide();
      const data = res.data.data;
      if (!data.ride) {
        setRide(null);
        return;
      }
      setRide(data.ride);
      setDriver(data.driver);
      if (data.ride.driverLat && data.ride.driverLng) {
        setDriverLocation({ lat: data.ride.driverLat, lng: data.ride.driverLng });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load ride.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRide();
    const interval = setInterval(fetchRide, 5000);
    return () => clearInterval(interval);
  }, [fetchRide]);

  const passengerLocation = position && user?.role === 'passenger' ? position : null;

  useEffect(() => {
    if (!socket || !ride) return;
    socket.emit('join:ride', ride.id);
    const locHandler = (loc) => setDriverLocation(loc);
    const statusHandler = () => fetchRide();
    socket.on('driver:location', locHandler);
    socket.on('ride:status', statusHandler);
    return () => {
      socket.emit('leave:ride', ride.id);
      socket.off('driver:location', locHandler);
      socket.off('ride:status', statusHandler);
    };
  }, [socket, ride?.id]);

  useEffect(() => {
    if (!ride || user?.role !== 'passenger' || !isGranted) return;
    if (!['accepted', 'arrived', 'in_progress'].includes(ride.status)) return;
    if (watchStartedRef.current) return;
    watchStartedRef.current = true;

    startWatching((loc) => {
      if (socket?.connected) {
        socket.emit('location:update', { rideId: ride.id, lat: loc.lat, lng: loc.lng });
      }
    });

    return () => { watchStartedRef.current = false; };
  }, [ride?.id, ride?.status, user?.role, isGranted, socket?.connected]);

  const handleCancel = async () => {
    if (!ride) return;
    try {
      await rideAPI.cancelRide(ride.id);
      navigate('/passenger');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel.');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!ride) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Active Ride</h1>
        </div>
        <div className="empty-section">
          <div className="empty-icon">🚗</div>
          <h3>No active ride</h3>
          <p>You don't have an active ride right now.</p>
          {user?.role === 'passenger' && (
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/ride/request')}>
              Request a Ride
            </button>
          )}
        </div>
      </div>
    );
  }

  const statusDisplay = {
    pending: 'Waiting for a driver...',
    accepted: 'Driver is on the way!',
    arrived: 'Driver has arrived!',
    in_progress: 'Ride in progress...',
    completed: 'Ride completed!',
    cancelled: 'Ride cancelled.',
  };

  const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
  const dropoff = { lat: ride.dropoffLat, lng: ride.dropoffLng };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Your Ride</h1>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="ride-card">
        <div className="ride-card-top">
          <span className={`badge badge--${ride.status}`}>{ride.status}</span>
        </div>

        <p className="ride-card-status">{statusDisplay[ride.status]}</p>

        {driver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--off-white)', borderRadius: 'var(--radius-sm)' }}>
            {driver.profilePhoto ? (
              <img
                src={`${API_URL}/${driver.profilePhoto.replace(/\\/g, '/')}`}
                alt={driver.name}
                style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--pink-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--pink)' }}>
                {driver.name?.[0] || 'D'}
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--plum)', fontSize: '1rem' }}>{driver.name}</p>
              {driver.phone && <p style={{ margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{driver.phone}</p>}
            </div>
          </div>
        )}

        {['accepted', 'arrived', 'in_progress'].includes(ride.status) && (
          <div style={{ marginBottom: '1rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
            <RideRouteMap
              pickup={pickup}
              dropoff={dropoff}
              driverLocation={driverLocation}
              passengerLocation={passengerLocation}
              height="240px"
            />
          </div>
        )}

        <div className="ride-card-details">
          <div className="ride-detail">
            <span className="ride-detail-label">Pickup</span>
            <span className="ride-detail-value">{ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}</span>
          </div>
          <div className="ride-detail">
            <span className="ride-detail-label">Drop-off</span>
            <span className="ride-detail-value">{ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}</span>
          </div>
          {ride.distance && (
            <div className="ride-detail">
              <span className="ride-detail-label">Distance</span>
              <span className="ride-detail-value">{ride.distance} km</span>
            </div>
          )}
          {ride.fare > 0 && (
            <div className="ride-detail">
              <span className="ride-detail-label">Fare</span>
              <span className="ride-detail-value" style={{ fontWeight: 700 }}>{ride.fare} PKR</span>
            </div>
          )}
          {ride.paymentMethod && (
            <div className="ride-detail">
              <span className="ride-detail-label">Payment</span>
              <span className="ride-detail-value" style={{ textTransform: 'capitalize' }}>
                {ride.paymentMethod}
                {ride.paymentMethod === 'cash' && ride.status === 'completed' ? ' (due)' : ''}
              </span>
            </div>
          )}
          {ride.status !== 'pending' && driver && (
            <div className="ride-detail">
              <span className="ride-detail-label">Driver</span>
              <span className="ride-detail-value">{driver.name}</span>
            </div>
          )}
        </div>

        {ride.status === 'pending' && (
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleCancel}>
            Cancel Ride
          </button>
        )}
      </div>
    </div>
  );
}

export default ActiveRide;
