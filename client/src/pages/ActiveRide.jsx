import { useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AddressLabel from '../components/AddressLabel';
import { rideAPI, sosAPI, paymentsAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../constants/socketEvents';
import RideRouteMap from '../components/RideRouteMap';
import useGeolocation from '../hooks/useGeolocation';
import { ToastContext } from '../context/ToastContext';
import ReviewModal from '../components/ReviewModal';

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
  const toast = useContext(ToastContext);
  const watchStartedRef = useRef(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const fetchRide = useCallback(async () => {
    try {
      const res = await rideAPI.getActiveRide();
      const data = res.data.data;
      if (!data.ride) { setRide(null); return; }
      setRide(data.ride);
      setDriver(data.driver);
      if (data.ride.driverLat != null && data.ride.driverLng != null) setDriverLocation({ lat: data.ride.driverLat, lng: data.ride.driverLng });
    } catch (err) { setError(err.response?.data?.message || 'Failed to load ride.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRide(); }, [fetchRide]);

  const passengerLocation = position && user?.role === 'passenger' ? position : null;

  useEffect(() => {
    if (!socket || !ride) return;
    socket.emit(CLIENT_EVENTS.JOIN_RIDE, ride.id);
    const locHandler = (loc) => setDriverLocation(loc);
    const statusHandler = () => fetchRide();
    const connectHandler = () => fetchRide();
    socket.on(SERVER_EVENTS.DRIVER_LOCATION, locHandler);
    socket.on(SERVER_EVENTS.RIDE_STATUS, statusHandler);
    socket.on('connect', connectHandler);
    return () => {
      socket.emit(CLIENT_EVENTS.LEAVE_RIDE, ride.id);
      socket.off(SERVER_EVENTS.DRIVER_LOCATION, locHandler);
      socket.off(SERVER_EVENTS.RIDE_STATUS, statusHandler);
      socket.off('connect', connectHandler);
    };
  }, [socket, ride?.id]);

  useEffect(() => {
    if (!ride || user?.role !== 'passenger') return;
    if (!['accepted', 'arrived', 'in_progress'].includes(ride.status)) return;
    if (watchStartedRef.current) return;
    watchStartedRef.current = true;
    request();
    startWatching((loc) => { if (socket?.connected) socket.emit(CLIENT_EVENTS.LOCATION_UPDATE, { rideId: ride.id, lat: loc.lat, lng: loc.lng }); });
    return () => { watchStartedRef.current = false; };
  }, [ride?.id, ride?.status, user?.role, socket?.connected]);

  const [sosSending, setSosSending] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  const handleSOS = async () => {
    if (!ride || sosSending || sosSent) return;
    if (!window.confirm('Trigger SOS alert? Your emergency contacts and PinkDrive admins will be notified immediately.')) return;
    setSosSending(true);
    try { await sosAPI.trigger({ rideId: ride.id, lat: position?.lat || ride.passengerLat || ride.pickupLat, lng: position?.lng || ride.passengerLng || ride.pickupLng }); setSosSent(true); }
    catch (err) { setError(err.response?.data?.message || 'Failed to send SOS.'); }
    finally { setSosSending(false); }
  };

  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    if (!ride || paying) return;
    setPaying(true);
    try {
      const res = await paymentsAPI.createCheckoutSession(ride.id);
      window.location.href = res.data.data.url;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate payment.');
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!ride) return;
    try { await rideAPI.cancelRide(ride.id); navigate('/passenger'); }
    catch (err) { setError(err.response?.data?.message || 'Failed to cancel.'); }
  };

  const badgeClass = (status) => {
    const colors = { approved: 'badge-success', rejected: 'badge-error', pending: 'badge-warning', accepted: 'badge-info', arrived: 'badge-info', in_progress: 'badge-info', completed: 'badge-success', cancelled: 'badge-neutral', awaiting_payment: 'bg-[#fff8e1] text-[#f57f17]', payment_dispute: 'badge-error' };
    return `badge ${colors[status] || 'badge-warning'}`;
  };

  const pickup = useMemo(() => ride ? { lat: ride.pickupLat, lng: ride.pickupLng } : null, [ride?.pickupLat, ride?.pickupLng]);
  const dropoff = useMemo(() => ride ? { lat: ride.dropoffLat, lng: ride.dropoffLng } : null, [ride?.dropoffLat, ride?.dropoffLng]);

  if (loading) return <div className="page"><div className="space-y-3"><div className="loading-skeleton h-8 w-1/3" /><div className="loading-skeleton h-4 w-2/3" /><div className="loading-skeleton h-32" /></div></div>;

  if (!ride) {
    return (
      <div className="page">
        <div className="page-header"><h1>Active Ride</h1></div>
        <div className="empty-state mt-6">
          <Navigation className="w-10 h-10 mx-auto" />
          <h3>No active ride</h3>
          <p>You don't have an active ride right now.</p>
          {user?.role === 'passenger' && <button className="btn btn-primary mt-4" onClick={() => navigate('/ride/request')}>Request a Ride</button>}
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
    awaiting_payment: 'Ride completed. Payment pending.',
    payment_dispute: 'Payment dispute reported. Admin is reviewing.',
  };

  return (
    <div className="page">
      <div className="page-header page-header-accent"><h1>Your Ride</h1></div>

      {error && <p className="msg msg-error">{error}</p>}

      <div className="card p-5">
        <div className="mb-2"><span className={badgeClass(ride.status)}>{ride.status}</span></div>
        <p className="font-display text-lg font-semibold text-navy m-0 mb-4">{statusDisplay[ride.status]}</p>

        {driver && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-ivory rounded-sm">
            {driver.profilePhoto ? (
              <img src={`${API_URL}/${driver.profilePhoto.replace(/\\/g, '/')}`} alt={driver.name} className="w-[52px] h-[52px] rounded-full object-cover border-2 border-border" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="w-[52px] h-[52px] rounded-full bg-coral-light flex items-center justify-center text-[1.2rem] text-coral">{driver.name?.[0] || 'D'}</div>
            )}
            <div>
              <p className="m-0 font-semibold text-navy text-base">{driver.name}</p>
              {driver.phone && <p className="m-0 mt-0.5 text-stone text-sm">{driver.phone}</p>}
            </div>
          </div>
        )}

        {ride.status !== 'cancelled' && (
          <div className="mb-4 rounded-sm overflow-hidden border-2 border-border">
            <RideRouteMap pickup={pickup} dropoff={dropoff} driverLocation={driverLocation} passengerLocation={passengerLocation} height="240px" />
          </div>
        )}

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Pickup</span>
            <span className="font-medium text-navy font-mono"><AddressLabel address={ride.pickupAddress} lat={ride.pickupLat} lng={ride.pickupLng} /></span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Drop-off</span>
            <span className="font-medium text-navy font-mono"><AddressLabel address={ride.dropoffAddress} lat={ride.dropoffLat} lng={ride.dropoffLng} /></span>
          </div>
          {ride.distance && <div className="flex justify-between items-center text-sm"><span className="text-stone">Distance</span><span className="font-medium text-navy font-mono">{ride.distance} km</span></div>}
          {ride.fare > 0 && <div className="flex justify-between items-center text-sm"><span className="text-stone">Fare</span><span className="font-medium text-navy font-mono font-bold">{ride.fare} PKR</span></div>}
          {ride.paymentMethod && <div className="flex justify-between items-center text-sm"><span className="text-stone">Payment</span><span className="font-medium text-navy font-mono capitalize">{ride.paymentMethod}{ride.paymentMethod === 'cash' && ride.status === 'awaiting_payment' ? ' (due)' : ride.paymentStatus === 'paid' ? ' (paid)' : ''}</span></div>}
          {ride.status !== 'pending' && driver && <div className="flex justify-between items-center text-sm"><span className="text-stone">Driver</span><span className="font-medium text-navy font-mono">{driver.name}</span></div>}
        </div>

        {['accepted', 'arrived', 'in_progress'].includes(ride.status) && user?.role === 'passenger' && (
          <div className="mt-4 pt-4 border-t border-border">
            <button className="btn btn-danger btn-full" onClick={handleSOS} disabled={sosSending || sosSent}>
              {sosSent ? 'SOS Sent' : sosSending ? 'Sending...' : 'SOS Emergency'}
            </button>
            {sosSent && <p className="text-xs text-success text-center mt-1">Help is on the way. Admin has been notified.</p>}
          </div>
        )}

        {ride.status === 'awaiting_payment' && ride.paymentMethod === 'cash' && user?.role === 'passenger' && (
          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
            <p className="text-sm text-stone text-center m-0">Did you pay the driver?</p>
            <button className="btn btn-primary w-full" onClick={async () => {
              try {
                await rideAPI.acknowledgePayment(ride.id);
                toast?.showToast?.('Payment acknowledged. Ride completed.', 'success');
                fetchRide();
              } catch (err) {
                setError(err.response?.data?.message || 'Failed to acknowledge.');
              }
            }}>
              Yes, I Paid
            </button>
            <button className="btn btn-danger w-full" onClick={async () => {
              try {
                await rideAPI.reportIssue(ride.id, { disputeType: 'driver_false_claim', description: 'Driver claiming non-payment is incorrect.' });
                toast?.showToast?.('Issue reported. Admin will review.', 'success');
                fetchRide();
              } catch (err) {
                setError(err.response?.data?.message || 'Failed to report issue.');
              }
            }}>
              Report Issue — Driver Claims I Didn't Pay
            </button>
          </div>
        )}

        {ride.status === 'awaiting_payment' && ride.paymentMethod === 'stripe' && user?.role === 'passenger' && (
          <div className="mt-4 pt-4 border-t border-border">
            <button className="btn btn-primary btn-full" onClick={handlePay} disabled={paying}>
              {paying ? 'Processing...' : `Pay ${ride.fare} PKR via Card`}
            </button>
          </div>
        )}

        {ride.status === 'awaiting_payment' && user?.role === 'passenger' && (
          <div className="mt-4 pt-4 border-t border-border">
            <button className="btn btn-danger w-full" onClick={async () => {
              try {
                const type = window.prompt('Issue type: passenger_refused_payment, partial_payment, driver_extra_fare') || 'driver_extra_fare';
                await rideAPI.reportIssue(ride.id, { disputeType: type, description: window.prompt('Describe the issue:') || '' });
                toast?.showToast?.('Issue reported. Admin will review.', 'success');
                fetchRide();
              } catch (err) {
                setError(err.response?.data?.message || 'Failed to report issue.');
              }
            }}>
              Report Issue
            </button>
          </div>
        )}

        {ride.status === 'pending' && (
          <button className="btn btn-danger btn-full" onClick={handleCancel}>Cancel Ride</button>
        )}

        {ride.status === 'completed' && user?.role === 'passenger' && driver && (
          <div className="mt-4 pt-4 border-t border-[#F0E0E8]">
            <button
              className="w-full bg-[#E91E8C] text-white font-bold py-3 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none"
              onClick={() => setReviewOpen(true)}
            >
              ⭐ Rate Your Driver
            </button>
          </div>
        )}

        {ride.status === 'completed' && user?.role === 'driver' && (
          <div className="mt-4 pt-4 border-t border-[#F0E0E8] text-center">
            <p className="text-sm text-[#8B8B9E] m-0">Ride completed successfully</p>
          </div>
        )}
      </div>

      <ReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        rideId={ride.id}
        reviewedId={driver?.id}
        reviewedName={driver?.name}
        onSubmit={() => setReviewOpen(false)}
      />
    </div>
  );
}

export default ActiveRide;
