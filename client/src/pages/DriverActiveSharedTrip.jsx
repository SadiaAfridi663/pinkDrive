import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sharedTripAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../constants/socketEvents';
import RideRouteMap from '../components/RideRouteMap';
import AddressLabel from '../components/AddressLabel';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

const passengerStatusLabel = {
  accepted: 'Accepted',
  driver_arriving: 'Arriving',
  passenger_boarded: 'Boarded',
  in_progress: 'In Transit',
  dropped_off: 'Dropped Off',
  completed: 'Completed',
};

const passengerStatusColor = (status) => {
  const map = {
    accepted: 'bg-blue-50 text-blue-700 border-blue-200',
    driver_arriving: 'bg-amber-50 text-amber-700 border-amber-200',
    passenger_boarded: 'bg-violet-50 text-violet-700 border-violet-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    dropped_off: 'bg-gray-50 text-gray-500 border-gray-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return map[status] || 'bg-gray-50 text-gray-600 border-gray-200';
};

function DriverActiveSharedTrip() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const watchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const [trip, setTrip] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [passengerLocations, setPassengerLocations] = useState({});

  const fetchData = async () => {
    try {
      const tripsRes = await sharedTripAPI.getMyTrips();
      const found = (tripsRes.data.data.trips || []).find(t => t.id === tripId);
      if (!found) { setError('Shared trip not found.'); return; }
      setTrip(found);

      const passRes = await sharedTripAPI.getAcceptedPassengers(tripId);
      setPassengers(passRes.data.data.passengers || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trip.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tripId]);

  useEffect(() => {
    if (!socket || !tripId) return;

    const joinRoom = () => socket.emit(CLIENT_EVENTS.JOIN_TRIP, tripId);
    joinRoom();

    const handler = (data) => {
      if (data.tripId === tripId) {
        setTrip(prev => prev ? { ...prev, status: data.status, startedAt: data.startedAt, completedAt: data.completedAt } : prev);
        if (data.status === 'in_progress' || data.status === 'completed') {
          fetchData();
        }
      }
    };
    socket.on(SERVER_EVENTS.TRIP_STATUS, handler);

    // Re-fetch when passenger state changes
    const passengerHandler = () => fetchData();
    socket.on(SERVER_EVENTS.PASSENGER_BOARDED, passengerHandler);
    socket.on(SERVER_EVENTS.PASSENGER_DROPPED, passengerHandler);
    socket.on(SERVER_EVENTS.DRIVER_ARRIVING, passengerHandler);
    socket.on(SERVER_EVENTS.PASSENGER_JOINED, passengerHandler);
    socket.on(SERVER_EVENTS.PASSENGER_LEFT, passengerHandler);

    // Live passenger location
    const passengerLocationHandler = (data) => {
      if (data.tripId === tripId) {
        setPassengerLocations(prev => ({ ...prev, [data.userId]: { lat: data.lat, lng: data.lng } }));
      }
    };
    socket.on(SERVER_EVENTS.PASSENGER_LOCATION, passengerLocationHandler);

    const onReconnect = () => {
      joinRoom();
      fetchData();
    };
    socket.on('connect', onReconnect);

    return () => {
      socket.off(SERVER_EVENTS.TRIP_STATUS, handler);
      socket.off(SERVER_EVENTS.PASSENGER_BOARDED, passengerHandler);
      socket.off(SERVER_EVENTS.PASSENGER_DROPPED, passengerHandler);
      socket.off(SERVER_EVENTS.DRIVER_ARRIVING, passengerHandler);
      socket.off(SERVER_EVENTS.PASSENGER_JOINED, passengerHandler);
      socket.off(SERVER_EVENTS.PASSENGER_LEFT, passengerHandler);
      socket.off(SERVER_EVENTS.PASSENGER_LOCATION, passengerLocationHandler);
      socket.off('connect', onReconnect);
      socket.emit(CLIENT_EVENTS.LEAVE_TRIP, tripId);
    };
  }, [socket, tripId]);

  // Watch driver location and broadcast to shared trip room
  useEffect(() => {
    if (!trip || !['active', 'full', 'in_progress'].includes(trip.status) || !socket?.connected) return;

    const emitLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          socket.emit(CLIENT_EVENTS.LOCATION_UPDATE, { lat: loc.lat, lng: loc.lng });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    };

    emitLocation();

    locationIntervalRef.current = setInterval(emitLocation, 8000);

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [trip?.status, socket?.connected]);

  const handleStatusUpdate = async (status) => {
    setStatusLoading(true);
    try {
      await sharedTripAPI.updateStatus(tripId, status);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDriverArriving = async () => {
    setStatusLoading(true);
    try {
      await sharedTripAPI.driverArriving(tripId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleBoardPassenger = async (requestId) => {
    setActionLoading(requestId);
    try {
      await sharedTripAPI.boardPassenger(tripId, requestId);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to board passenger.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDropoffPassenger = async (requestId) => {
    setActionLoading(requestId);
    try {
      await sharedTripAPI.dropoffPassenger(tripId, requestId);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to drop off passenger.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return (
    <div className="p-5 lg:p-8 animate-pulse space-y-4 max-w-4xl w-full">
      <div className="h-8 bg-gray-200 rounded-lg w-1/3" />
      <div className="h-52 bg-gray-200 rounded-2xl" />
    </div>
  );

  if (error) return (
    <div className="p-5 lg:p-8 max-w-4xl w-full text-center">
      <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 shadow-sm">
        <p className="text-red-500 m-0 mb-4">{error}</p>
        <button className="bg-[#E91E8C] text-white font-bold text-sm py-2.5 px-6 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none" onClick={() => navigate('/driver/dashboard')}>Back to Dashboard</button>
      </div>
    </div>
  );

  if (!trip) return null;

  const statusColor = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    full: 'bg-amber-50 text-amber-700 border-amber-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-gray-50 text-gray-500 border-gray-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
  };

  const passengerMarkers = passengers.map(p => {
    const live = passengerLocations[p.passengerId];
    return {
      lat: live ? live.lat : p.pickupLat,
      lng: live ? live.lng : p.pickupLng,
      passengerPhoto: p.passengerPhoto,
      name: p.passengerName,
      isLive: !!live,
    };
  });

  const showArriving = trip.status === 'active' || trip.status === 'full';
  const showStart = trip.status === 'active' || trip.status === 'full';
  const showComplete = trip.status === 'in_progress';
  const hasUnboarded = passengers.some(p => p.status === 'accepted' || p.status === 'driver_arriving');

  return (
    <div className="p-5 lg:p-8 max-w-4xl w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-[#880E4F] m-0">Active Shared Trip</h2>
          <p className="text-sm text-[#8B8B9E] m-0 mt-0.5">Manage your shared trip</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusColor[trip.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {trip.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-5">
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="bg-[#FFF8FA] rounded-xl p-4">
              <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Price per Seat</p>
              <p className="text-xl font-bold text-amber-700 font-mono m-0">{trip.pricePerSeat} PKR</p>
            </div>
            <div className="bg-[#FFF8FA] rounded-xl p-4">
              <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Seats Left</p>
              <p className="text-xl font-bold text-[#880E4F] font-mono m-0">{trip.availableSeats}</p>
            </div>
            <div className="bg-[#FFF8FA] rounded-xl p-4">
              <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Passengers</p>
              <p className="text-xl font-bold text-[#880E4F] font-mono m-0">{passengers.length}</p>
            </div>
            <div className="bg-[#FFF8FA] rounded-xl p-4">
              <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Departure</p>
              <p className="text-sm font-semibold text-[#1A1A1A] m-0">
                {new Date(trip.departureTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-[#F0E0E8] mb-5">
            <RideRouteMap
              pickup={{ lat: trip.pickupLat, lng: trip.pickupLng }}
              dropoff={{ lat: trip.dropoffLat, lng: trip.dropoffLng }}
              passengerMarkers={passengerMarkers}
              height="280px"
            />
          </div>
          <div className="flex items-center gap-6 mb-5 text-xs text-[#8B8B9E]">
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-[#e9408b]" /><span>Trip route</span></div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-[#e9408b] bg-white inline-block" />
              <span>Passenger pickup</span>
            </div>
          </div>

          <div className="space-y-3 mb-5 pb-5 border-b border-[#F0E0E8]">
            <p className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0">Route</p>
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 mt-1 rounded-full bg-emerald-500 flex-shrink-0" />
              <div className="text-sm"><span className="text-[#8B8B9E]">Pickup </span><span className="font-medium"><AddressLabel address={trip.pickupAddress} lat={trip.pickupLat} lng={trip.pickupLng} /></span></div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 mt-1 rounded-full bg-[#1A1A1A] flex-shrink-0" />
              <div className="text-sm"><span className="text-[#8B8B9E]">Drop-off </span><span className="font-medium"><AddressLabel address={trip.dropoffAddress} lat={trip.dropoffLat} lng={trip.dropoffLng} /></span></div>
            </div>
          </div>

          {showArriving && (
            <button
              onClick={handleDriverArriving}
              disabled={statusLoading}
              className="w-full bg-amber-500 text-white font-bold text-sm py-3.5 rounded-xl hover:bg-amber-600 transition cursor-pointer border-none shadow-sm disabled:opacity-50 mb-3"
            >
              {statusLoading ? 'Updating...' : 'I\'m Arriving'}
            </button>
          )}
          {showStart && (
            <button
              onClick={() => handleStatusUpdate('in_progress')}
              disabled={statusLoading}
              className="w-full bg-blue-500 text-white font-bold text-sm py-3.5 rounded-xl hover:bg-blue-600 transition cursor-pointer border-none shadow-sm disabled:opacity-50 mb-3"
            >
              {statusLoading ? 'Updating...' : 'Start Trip'}
            </button>
          )}
          {showComplete && (
            <button
              onClick={() => handleStatusUpdate('completed')}
              disabled={statusLoading}
              className="w-full bg-emerald-500 text-white font-bold text-sm py-3.5 rounded-xl hover:bg-emerald-600 transition cursor-pointer border-none shadow-sm disabled:opacity-50 mb-3"
            >
              {statusLoading ? 'Updating...' : 'Complete Trip'}
            </button>
          )}
        </div>
      </div>

      {passengers.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#F0E0E8]">
            <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0">
              Passengers ({passengers.length})
            </h3>
          </div>
          <div className="divide-y divide-[#F0E0E8]">
            {passengers.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-lg font-bold text-amber-600 flex-shrink-0 border-2 border-amber-200 overflow-hidden">
                    {p.passengerPhoto ? (
                      <img src={`${API_URL}/${p.passengerPhoto.replace(/\\/g, '/')}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      p.passengerName?.[0] || 'P'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#1A1A1A] m-0">{p.passengerName || 'Passenger'}</p>
                      {p.status && (
                        <span className={`text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full border ${passengerStatusColor(p.status)}`}>
                          {passengerStatusLabel[p.status] || p.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8B8B9E] m-0 mt-0.5">Pickup: {p.pickupAddress || `${p.pickupLat?.toFixed(4)}, ${p.pickupLng?.toFixed(4)}`}</p>
                    <p className="text-xs text-[#8B8B9E] m-0">Dropoff: {p.dropoffAddress || `${p.dropoffLat?.toFixed(4)}, ${p.dropoffLng?.toFixed(4)}`}</p>
                  </div>
                </div>
                {/* Per-passenger lifecycle actions */}
                <div className="flex gap-2 ml-16">
                  {(p.status === 'accepted' || p.status === 'driver_arriving') && (
                    <button
                      onClick={() => handleBoardPassenger(p.id)}
                      disabled={actionLoading === p.id}
                      className="text-xs bg-violet-500 text-white font-semibold py-1.5 px-3 rounded-lg hover:bg-violet-600 transition cursor-pointer border-none disabled:opacity-50"
                    >
                      {actionLoading === p.id ? '...' : 'Mark Boarded'}
                    </button>
                  )}
                  {(p.status === 'passenger_boarded' || p.status === 'in_progress') && (
                    <button
                      onClick={() => handleDropoffPassenger(p.id)}
                      disabled={actionLoading === p.id}
                      className="text-xs bg-emerald-500 text-white font-semibold py-1.5 px-3 rounded-lg hover:bg-emerald-600 transition cursor-pointer border-none disabled:opacity-50"
                    >
                      {actionLoading === p.id ? '...' : 'Drop Off'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverActiveSharedTrip;
