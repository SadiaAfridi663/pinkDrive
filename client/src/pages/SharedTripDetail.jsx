import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sharedTripAPI, sosAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../constants/socketEvents';
import RideRouteMap from '../components/RideRouteMap';
import AddressLabel from '../components/AddressLabel';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function SharedTripDetail() {
  const { requestId } = useParams();
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sosSending, setSosSending] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverLastSeen, setDriverLastSeen] = useState(null);

  const fetchRequest = useCallback(async () => {
    try {
      const res = await sharedTripAPI.getMyRequests();
      const found = res.data.data.requests.find(r => r.id === requestId);
      if (found) setRequest(found);
    } catch {
      // silently fail
    }
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sharedTripAPI.getMyRequests();
        const found = res.data.data.requests.find(r => r.id === requestId);
        if (!cancelled) {
          if (found) setRequest(found);
          else setError('Shared trip request not found.');
        }
      } catch {
        if (!cancelled) setError('Failed to load trip details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestId]);

  // Join trip room when request is accepted/in_progress for real-time updates
  useEffect(() => {
    if (!socket || !request) return;
    const isActive = ['accepted', 'in_progress', 'passenger_boarded', 'driver_arriving'].includes(request.status);

    const joinRoom = () => {
      if (isActive && request.tripId) {
        socket.emit(CLIENT_EVENTS.JOIN_TRIP, request.tripId);
      }
    };

    joinRoom();

    // Listen for request status changes (accepted/declined/cancelled)
    const requestHandler = () => fetchRequest();
    socket.on(SERVER_EVENTS.TRIP_REQUEST_ACCEPTED, requestHandler);
    socket.on(SERVER_EVENTS.TRIP_REQUEST_DECLINED, requestHandler);
    socket.on(SERVER_EVENTS.TRIP_CANCELLED, requestHandler);

    // Listen for trip status changes (in_progress/completed)
    const tripHandler = (data) => {
      if (data.tripId === request.tripId) {
        setRequest(prev => prev ? {
          ...prev,
          trip: { ...prev.trip, status: data.status, startedAt: data.startedAt, completedAt: data.completedAt },
        } : prev);
      }
    };
    socket.on(SERVER_EVENTS.TRIP_STATUS, tripHandler);

    // Listen for lifecycle and passenger sync events
    const lifecycleHandler = (data) => {
      if (data.tripId === request.tripId) {
        fetchRequest();
      }
    };
    socket.on(SERVER_EVENTS.DRIVER_ARRIVING, lifecycleHandler);
    socket.on(SERVER_EVENTS.PASSENGER_BOARDED, lifecycleHandler);
    socket.on(SERVER_EVENTS.PASSENGER_DROPPED, lifecycleHandler);
    socket.on(SERVER_EVENTS.PASSENGER_JOINED, lifecycleHandler);
    socket.on(SERVER_EVENTS.PASSENGER_LEFT, lifecycleHandler);
    socket.on(SERVER_EVENTS.PASSENGER_REMOVED, lifecycleHandler);

    // Listen for live driver location
    const locationHandler = (data) => {
      if (data.tripId === request.tripId) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
        setDriverLastSeen(Date.now());
      }
    };
    socket.on(SERVER_EVENTS.DRIVER_LOCATION, locationHandler);

    // Reconnect: re-join trip room and re-fetch state
    const onReconnect = () => {
      joinRoom();
      fetchRequest();
    };
    socket.on('connect', onReconnect);

    return () => {
      if (isActive && request.tripId) {
        socket.emit(CLIENT_EVENTS.LEAVE_TRIP, request.tripId);
      }
      socket.off(SERVER_EVENTS.TRIP_REQUEST_ACCEPTED, requestHandler);
      socket.off(SERVER_EVENTS.TRIP_REQUEST_DECLINED, requestHandler);
      socket.off(SERVER_EVENTS.TRIP_CANCELLED, requestHandler);
      socket.off(SERVER_EVENTS.TRIP_STATUS, tripHandler);
      socket.off(SERVER_EVENTS.DRIVER_ARRIVING, lifecycleHandler);
      socket.off(SERVER_EVENTS.PASSENGER_BOARDED, lifecycleHandler);
      socket.off(SERVER_EVENTS.PASSENGER_DROPPED, lifecycleHandler);
      socket.off(SERVER_EVENTS.PASSENGER_JOINED, lifecycleHandler);
      socket.off(SERVER_EVENTS.PASSENGER_LEFT, lifecycleHandler);
      socket.off(SERVER_EVENTS.PASSENGER_REMOVED, lifecycleHandler);
      socket.off(SERVER_EVENTS.DRIVER_LOCATION, locationHandler);
      socket.off('connect', onReconnect);
    };
  }, [socket, request?.id, request?.tripId, request?.status]);

  // Watch passenger location and broadcast to shared trip room
  useEffect(() => {
    const shouldTrack = request && ['accepted', 'driver_arriving'].includes(request.status);
    if (!shouldTrack || !socket?.connected || !navigator.geolocation) return;

    const intervalRef = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          socket.emit(CLIENT_EVENTS.LOCATION_UPDATE, {
            lat: pos.coords.latitude, lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }, 8000);

    return () => clearInterval(intervalRef);
  }, [socket?.connected, request?.status]);

  const handleSOS = async () => {
    if (!request || sosSending) return;
    if (!window.confirm('Trigger SOS alert? Your emergency contacts and PinkDrive admins will be notified immediately.')) return;
    setSosSending(true);
    try {
      await sosAPI.trigger({
        lat: request.pickupLat,
        lng: request.pickupLng,
      });
    } catch {
      setError('Failed to send SOS.');
    } finally {
      setSosSending(false);
    }
  };

  const handleCancel = async () => {
    if (!request) return;
    const reason = window.prompt('Reason for cancellation (optional):');
    try {
      await sharedTripAPI.cancelTrip(request.tripId);
      navigate('/passenger');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel.');
    }
  };

  const statusColor = (status) => {
    const map = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      driver_arriving: 'bg-blue-50 text-blue-700 border-blue-200',
      passenger_boarded: 'bg-violet-50 text-violet-700 border-violet-200',
      in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
      dropped_off: 'bg-gray-50 text-gray-500 border-gray-200',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      declined: 'bg-red-50 text-red-600 border-red-200',
      cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
    };
    return map[status] || 'bg-gray-50 text-gray-600 border-gray-200';
  };

  if (loading) return (
    <div className="p-5 lg:p-8 animate-pulse space-y-4 max-w-4xl w-full">
      <div className="h-8 bg-gray-200 rounded-lg w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-52 bg-gray-200 rounded-2xl" />
    </div>
  );

  if (error) return (
    <div className="p-5 lg:p-8 max-w-4xl w-full">
      <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 text-center shadow-sm">
        <p className="text-sm text-red-500 m-0">{error}</p>
        <button className="mt-4 bg-[#E91E8C] text-white font-bold text-sm py-2.5 px-6 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none" onClick={() => navigate('/passenger')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  if (!request) return null;

  const trip = request.trip || {};
  const isActiveRide = ['accepted', 'in_progress', 'passenger_boarded', 'driver_arriving'].includes(request.status);

  const tripPickup = trip.pickupLat != null ? { lat: trip.pickupLat, lng: trip.pickupLng } : null;
  const tripDropoff = trip.dropoffLat != null ? { lat: trip.dropoffLat, lng: trip.dropoffLng } : null;
  const passengerPickup = request.pickupLat != null ? { lat: request.pickupLat, lng: request.pickupLng } : null;
  const passengerDropoff = request.dropoffLat != null ? { lat: request.dropoffLat, lng: request.dropoffLng } : null;

  return (
    <div className="p-5 lg:p-8 max-w-4xl w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-[#880E4F] m-0">Shared Trip</h2>
          <p className="text-sm text-[#8B8B9E] m-0 mt-0.5">Your shared trip details</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusColor(request.status)}`}>
          {request.status}
        </span>
      </div>

      {request.status === 'declined' && request.declineReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
          <span className="font-bold">Declined: </span>{request.declineReason}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-5">
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-2xl font-bold text-amber-600 flex-shrink-0 border-2 border-amber-200 overflow-hidden">
              {request.driverPhoto ? (
                <img src={`${API_URL}/${request.driverPhoto.replace(/\\/g, '/')}`} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = request.driverName?.[0] || 'D'; }} />
              ) : (
                request.driverName?.[0] || 'D'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-[#1A1A1A] m-0">{request.driverName || 'Driver'}</p>
              <p className="text-sm text-[#8B8B9E] m-0">{request.driverPhone || ''}</p>
            </div>
            <button
              onClick={() => navigate(`/driver/profile/${trip.driverId}`)}
              className="bg-white border border-[#F0E0E8] text-[#880E4F] font-semibold text-sm py-2 px-5 rounded-xl hover:border-[#E91E8C] hover:bg-[#FFF8FA] transition cursor-pointer"
            >
              View Profile
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-[#FFF8FA] rounded-xl p-4">
              <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Price per Seat</p>
              <p className="text-xl font-bold text-amber-700 font-mono m-0">{trip.pricePerSeat} PKR</p>
            </div>
            <div className="bg-[#FFF8FA] rounded-xl p-4">
              <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Departure</p>
              <p className="text-sm font-semibold text-[#1A1A1A] m-0">
                {trip.departureTime ? new Date(trip.departureTime).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <div className="bg-[#FFF8FA] rounded-xl p-4">
              <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Payment</p>
              <p className="text-sm font-semibold text-[#1A1A1A] m-0 capitalize">{trip.paymentMethod || 'Cash'}</p>
            </div>
            <div className="bg-[#FFF8FA] rounded-xl p-4">
              <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Seats Left</p>
              <p className="text-sm font-semibold text-[#1A1A1A] m-0">{trip.availableSeats ?? '—'}</p>
            </div>
          </div>

          <div className="space-y-3 mb-5 pb-5 border-b border-[#F0E0E8]">
            <p className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0">Trip Route</p>
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
              <div className="text-sm">
                <span className="text-[#8B8B9E]">Pickup </span>
                <span className="font-medium text-[#1A1A1A]"><AddressLabel address={trip.pickupAddress} lat={trip.pickupLat} lng={trip.pickupLng} /></span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A1A1A] flex-shrink-0 mt-1" />
              <div className="text-sm">
                <span className="text-[#8B8B9E]">Drop-off </span>
                <span className="font-medium text-[#1A1A1A]"><AddressLabel address={trip.dropoffAddress} lat={trip.dropoffLat} lng={trip.dropoffLng} /></span>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-5">
            <p className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0">Your Pickup & Drop-off</p>
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0 mt-1" />
              <div className="text-sm">
                <span className="text-[#8B8B9E]">Your Pickup </span>
                <span className="font-medium text-[#1A1A1A]"><AddressLabel address={request.pickupAddress} lat={request.pickupLat} lng={request.pickupLng} /></span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0 mt-1" />
              <div className="text-sm">
                <span className="text-[#8B8B9E]">Your Drop-off </span>
                <span className="font-medium text-[#1A1A1A]"><AddressLabel address={request.dropoffAddress} lat={request.dropoffLat} lng={request.dropoffLng} /></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-5">
        <div className="p-4 pb-0">
          <p className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-2">
            Route Map
          </p>
          {isActiveRide && (
            <div className="mb-3 text-xs">
              {driverLocation ? (
                <span className={`inline-flex items-center gap-1.5 ${driverLastSeen && Date.now() - driverLastSeen > 30000 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  <span className={`w-2 h-2 rounded-full ${driverLastSeen && Date.now() - driverLastSeen > 30000 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                  {driverLastSeen && Date.now() - driverLastSeen > 30000
                    ? `Driver location stale — last seen ${Math.round((Date.now() - driverLastSeen) / 1000)}s ago`
                    : 'Driver location live'}
                </span>
              ) : (
                <span className="text-[#8B8B9E]">Waiting for driver location...</span>
              )}
            </div>
          )}
        </div>
        <RideRouteMap
          pickup={tripPickup}
          dropoff={tripDropoff}
          driverLocation={driverLocation}
          secondaryPickup={passengerPickup}
          secondaryDropoff={passengerDropoff}
          height="260px"
        />
        <div className="p-4 flex items-center gap-6 text-xs text-[#8B8B9E]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-[#e9408b]" />
            <span>Trip route</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-[#f59e0b]" style={{ borderTop: '2px dashed #f59e0b', height: 0, borderTopWidth: 2 }} />
            <span>Your route</span>
          </div>
          {driverLocation && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
              <span>Driver</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        {isActiveRide && (
          <button
            onClick={handleSOS}
            disabled={sosSending}
            className="flex-1 bg-red-500 text-white font-bold text-sm py-3 rounded-xl hover:bg-red-600 transition cursor-pointer border-none disabled:opacity-50"
          >
            {sosSending ? 'Sending...' : 'SOS Emergency'}
          </button>
        )}
        {request.status === 'pending' && (
          <button
            onClick={handleCancel}
            className="flex-1 bg-white border-2 border-[#F0E0E8] text-[#8B8B9E] font-semibold text-sm py-3 rounded-xl hover:border-red-200 hover:text-red-500 transition cursor-pointer"
          >
            Cancel Request
          </button>
        )}
      </div>
    </div>
  );
}

export default SharedTripDetail;