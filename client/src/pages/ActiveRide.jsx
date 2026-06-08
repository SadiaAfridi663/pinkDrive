import { useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI, sosAPI } from '../services/api';
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
  const { position, isGranted, startWatching, request } = useGeolocation();
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
      if (data.ride.driverLat != null && data.ride.driverLng != null) {
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
    if (!ride || user?.role !== 'passenger') return;
    if (!['accepted', 'arrived', 'in_progress'].includes(ride.status)) return;
    if (watchStartedRef.current) return;
    watchStartedRef.current = true;

    request();

    startWatching((loc) => {
      if (socket?.connected) {
        socket.emit('location:update', { rideId: ride.id, lat: loc.lat, lng: loc.lng });
      }
    });

    return () => { watchStartedRef.current = false; };
  }, [ride?.id, ride?.status, user?.role, socket?.connected]);

  const [sosSending, setSosSending] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  const handleSOS = async () => {
    if (!ride || sosSending || sosSent) return;
    if (!window.confirm('Trigger SOS alert? Your emergency contacts and PinkDrive admins will be notified immediately.')) return;
    setSosSending(true);
    try {
      await sosAPI.trigger({
        rideId: ride.id,
        lat: position?.lat || ride.passengerLat || ride.pickupLat,
        lng: position?.lng || ride.passengerLng || ride.pickupLng,
      });
      setSosSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send SOS.');
    } finally {
      setSosSending(false);
    }
  };

  const handleCancel = async () => {
    if (!ride) return;
    try {
      await rideAPI.cancelRide(ride.id);
      navigate('/passenger');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel.');
    }
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

  const pickup = useMemo(() => ride ? { lat: ride.pickupLat, lng: ride.pickupLng } : null, [ride?.pickupLat, ride?.pickupLng]);
  const dropoff = useMemo(() => ride ? { lat: ride.dropoffLat, lng: ride.dropoffLng } : null, [ride?.dropoffLat, ride?.dropoffLng]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;

  if (!ride) {
    return (
      <div className="max-w-page mx-auto px-6 py-8 pb-16">
        <div className="mb-8">
          <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Active Ride</h1>
        </div>
        <div className="text-center p-12 mt-8">
          <div className="text-4xl mb-2">&#128663;</div>
          <h3 className="font-display text-[1.2rem] font-semibold text-plum m-0 mb-1">No active ride</h3>
          <p className="text-sm text-text-muted m-0">You don't have an active ride right now.</p>
          {user?.role === 'passenger' && (
            <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-4" onClick={() => navigate('/ride/request')}>
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

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Your Ride</h1>
      </div>

      {error && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{error}</p>}

      <div className="bg-white border border-border rounded p-5">
        <div className="mb-2">
          <span className={badgeClass(ride.status)}>{ride.status}</span>
        </div>

        <p className="font-display text-lg font-semibold text-plum m-0 mb-4">{statusDisplay[ride.status]}</p>

        {driver && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-off-white rounded-sm">
            {driver.profilePhoto ? (
              <img
                src={`${API_URL}/${driver.profilePhoto.replace(/\\/g, '/')}`}
                alt={driver.name}
                className="w-[52px] h-[52px] rounded-full object-cover border-2 border-border"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-[52px] h-[52px] rounded-full bg-pink-subtle flex items-center justify-center text-[1.2rem] text-pink">
                {driver.name?.[0] || 'D'}
              </div>
            )}
            <div>
              <p className="m-0 font-semibold text-plum text-base">{driver.name}</p>
              {driver.phone && <p className="m-0 mt-0.5 text-text-muted text-sm">{driver.phone}</p>}
            </div>
          </div>
        )}

        {['accepted', 'arrived', 'in_progress'].includes(ride.status) && (
          <div className="mb-4 rounded-sm overflow-hidden border-2 border-border">
            <RideRouteMap
              pickup={pickup}
              dropoff={dropoff}
              driverLocation={driverLocation}
              passengerLocation={passengerLocation}
              height="240px"
            />
          </div>
        )}

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Pickup</span>
            <span className="font-medium text-plum font-mono">{ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Drop-off</span>
            <span className="font-medium text-plum font-mono">{ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}</span>
          </div>
          {ride.distance && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Distance</span>
              <span className="font-medium text-plum font-mono">{ride.distance} km</span>
            </div>
          )}
          {ride.fare > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Fare</span>
              <span className="font-medium text-plum font-mono font-bold">{ride.fare} PKR</span>
            </div>
          )}
          {ride.paymentMethod && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Payment</span>
              <span className="font-medium text-plum font-mono capitalize">
                {ride.paymentMethod}
                {ride.paymentMethod === 'cash' && ride.status === 'completed' ? ' (due)' : ''}
              </span>
            </div>
          )}
          {ride.status !== 'pending' && driver && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Driver</span>
              <span className="font-medium text-plum font-mono">{driver.name}</span>
            </div>
          )}
        </div>

        {['accepted', 'arrived', 'in_progress'].includes(ride.status) && user?.role === 'passenger' && (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              className="w-full inline-flex items-center justify-center gap-2 font-body font-semibold text-sm border-2 border-error rounded-sm px-5 py-3 cursor-pointer transition bg-[#ffebee] text-error hover:bg-error hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSOS}
              disabled={sosSending || sosSent}
            >
              {sosSent ? 'SOS Sent' : sosSending ? 'Sending...' : 'SOS Emergency'}
            </button>
            {sosSent && <p className="text-xs text-success text-center mt-1">Help is on the way. Admin has been notified.</p>}
          </div>
        )}

        {ride.status === 'pending' && (
          <button className="bg-transparent border-2 border-[#ffcdd2] text-error hover:bg-[#ffebee] inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition w-full" onClick={handleCancel}>
            Cancel Ride
          </button>
        )}
      </div>
    </div>
  );
}

export default ActiveRide;
