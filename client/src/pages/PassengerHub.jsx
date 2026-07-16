import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AddressLabel from '../components/AddressLabel';
import RideRouteMap from '../components/RideRouteMap';
import { rideAPI, walletAPI, sosAPI, sharedTripAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../constants/socketEvents';
import useGeolocation from '../hooks/useGeolocation';
import DashboardLayout from '../components/DashboardLayout';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function DashboardView() {
  const [activeRide, setActiveRide] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
  const [activeSharedRequest, setActiveSharedRequest] = useState(null);
  const [history, setHistory] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const navigate = useNavigate();

  const fetch = useCallback(async (mounted = true) => {
    try {
      const [activeRes, historyRes, walletRes, sharedRes] = await Promise.all([
        rideAPI.getActiveRide(),
        rideAPI.getHistory().catch(() => ({ data: { data: { rides: [] } } })),
        walletAPI.getWallet().catch(() => ({ data: { data: { wallet: { balance: 0 } } } })),
        sharedTripAPI.getMyRequests().catch(() => ({ data: { data: { requests: [] } } })),
      ]);
      if (mounted) {
        const active = activeRes.data.data;
        setActiveRide(active.ride);
        setActiveDriver(active.driver);
        setHistory(historyRes.data.data.rides.slice(0, 5));
        setWalletBalance(walletRes.data.data.wallet.balance);
        const reqs = sharedRes.data.data.requests || [];
        const activeShared = reqs.find(r => ['accepted', 'in_progress', 'passenger_boarded', 'driver_arriving'].includes(r.status));
        setActiveSharedRequest(activeShared || null);
      }
    } catch {
      // no active ride
    } finally {
      if (mounted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch(mounted);
    const interval = setInterval(() => fetch(mounted), 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, [fetch]);

  useEffect(() => {
    if (!socket || !activeRide) return;
    socket.emit(CLIENT_EVENTS.JOIN_RIDE, activeRide.id);
    const handler = () => fetch(true);
    socket.on(SERVER_EVENTS.RIDE_STATUS, handler);
    return () => { socket.emit(CLIENT_EVENTS.LEAVE_RIDE, activeRide.id); socket.off(SERVER_EVENTS.RIDE_STATUS, handler); };
  }, [socket, activeRide?.id]);

  useEffect(() => {
    if (!socket) return;
    const sharedHandler = () => fetch(true);
    socket.on(SERVER_EVENTS.TRIP_REQUEST_ACCEPTED, sharedHandler);
    socket.on(SERVER_EVENTS.TRIP_REQUEST_DECLINED, sharedHandler);
    socket.on(SERVER_EVENTS.TRIP_CANCELLED, sharedHandler);
    socket.on(SERVER_EVENTS.TRIP_STATUS, sharedHandler);
    socket.on(SERVER_EVENTS.PASSENGER_JOINED, sharedHandler);
    socket.on(SERVER_EVENTS.PASSENGER_LEFT, sharedHandler);
    socket.on(SERVER_EVENTS.PASSENGER_REMOVED, sharedHandler);
    return () => {
      socket.off(SERVER_EVENTS.TRIP_REQUEST_ACCEPTED, sharedHandler);
      socket.off(SERVER_EVENTS.TRIP_REQUEST_DECLINED, sharedHandler);
      socket.off(SERVER_EVENTS.TRIP_CANCELLED, sharedHandler);
      socket.off(SERVER_EVENTS.TRIP_STATUS, sharedHandler);
      socket.off(SERVER_EVENTS.PASSENGER_JOINED, sharedHandler);
      socket.off(SERVER_EVENTS.PASSENGER_LEFT, sharedHandler);
      socket.off(SERVER_EVENTS.PASSENGER_REMOVED, sharedHandler);
    };
  }, [socket]);

  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening';
  const nameFirst = user?.name?.split(' ')[0] || 'there';

  const statusDisplay = {
    pending: 'Looking for a driver...',
    accepted: 'Driver on the way!',
    arrived: 'Driver arrived!',
    in_progress: 'On your way!',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  const statusColor = (status) => {
    const map = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      accepted: 'bg-blue-50 text-blue-700 border-blue-200',
      arrived: 'bg-blue-50 text-blue-700 border-blue-200',
      in_progress: 'bg-violet-50 text-violet-700 border-violet-200',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
    };
    return map[status] || 'bg-gray-50 text-gray-600 border-gray-200';
  };

  if (loading) return (
    <div className="p-5 lg:p-8 animate-pulse space-y-4 max-w-4xl">
      <div className="h-8 bg-gray-200 rounded-lg w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-44 bg-gray-200 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-5 lg:p-8 w-[70%]">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-[#880E4F] m-0">{greeting}, {nameFirst}</h2>
          <p className="text-sm text-[#8B8B9E] m-0 mt-0.5">Ready for your next ride?</p>
        </div>
        {walletBalance !== null && (
          <button
            onClick={() => navigate('/wallet')}
            className="flex items-center gap-2 bg-white border border-[#F0E0E8] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#880E4F] hover:border-[#E91E8C] hover:shadow-sm transition cursor-pointer shadow-sm"
          >
            <svg className="w-4 h-4 text-[#E91E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M16 12a2 2 0 114 0 2 2 0 01-4 0" /></svg>
            {parseFloat(walletBalance).toFixed(0)} PKR
          </button>
        )}
      </div>

      {activeRide ? (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-7">
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusColor(activeRide.status)}`}>
                {activeRide.status.replace(/_/g, ' ')}
              </span>
              {activeRide.fare > 0 && (
                <span className="text-xl font-bold text-[#880E4F] font-mono">{activeRide.fare} PKR</span>
              )}
            </div>
            <p className="text-lg font-bold text-[#1A1A1A] m-0 mb-5">{statusDisplay[activeRide.status]}</p>

            {activeDriver && (
              <div className="flex items-center gap-3 mb-5 bg-[#FFF8FA] rounded-xl p-3.5">
                {activeDriver.profilePhoto ? (
                  <img src={`${API_URL}/${activeDriver.profilePhoto.replace(/\\/g, '/')}`} alt={activeDriver.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#F0E0E8] flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#FCE4EC] flex items-center justify-center text-lg font-bold text-[#E91E8C] flex-shrink-0">{activeDriver.name?.[0] || 'D'}</div>
                )}
                <div><p className="m-0 font-bold text-[#1A1A1A]">{activeDriver.name}</p><p className="m-0 text-xs text-[#8B8B9E]">Your driver</p></div>
              </div>
            )}

            <div className="space-y-3 mb-5 pb-5 border-b border-[#F0E0E8]">
              <div className="flex items-start gap-3">
                <svg className="w-2.5 h-2.5 mt-1.5 text-[#E91E8C] flex-shrink-0" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5" /></svg>
                <div className="text-sm"><span className="text-[#8B8B9E]">Pickup </span><span className="font-medium text-[#1A1A1A]"><AddressLabel address={activeRide.pickupAddress} lat={activeRide.pickupLat} lng={activeRide.pickupLng} /></span></div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-2.5 h-2.5 mt-1.5 text-[#1A1A1A] flex-shrink-0" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5" /></svg>
                <div className="text-sm"><span className="text-[#8B8B9E]">Drop-off </span><span className="font-medium text-[#1A1A1A]"><AddressLabel address={activeRide.dropoffAddress} lat={activeRide.dropoffLat} lng={activeRide.dropoffLng} /></span></div>
              </div>
              {activeRide.distance > 0 && <p className="text-xs text-[#8B8B9E] m-0 ml-5">{activeRide.distance} km</p>}
            </div>

            <button
              className="w-full bg-[#E91E8C] text-white font-bold text-sm py-3.5 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none shadow-sm"
              onClick={() => navigate(activeRide.status === 'pending' ? `/ride/bidding/${activeRide.id}` : '/ride/active')}
            >
              View Ride Details
            </button>
          </div>
        </div>
      ) : activeSharedRequest ? (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-7">
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-200">
                Accepted
              </span>
              {activeSharedRequest.trip?.pricePerSeat && (
                <span className="text-xl font-bold text-amber-700 font-mono">{activeSharedRequest.trip.pricePerSeat} PKR</span>
              )}
            </div>
            <p className="text-lg font-bold text-[#1A1A1A] m-0 mb-5">Shared trip accepted! Driver is preparing.</p>

            <div className="flex items-center gap-3 mb-5 bg-amber-50 rounded-xl p-3.5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-lg font-bold text-amber-600 flex-shrink-0 border-2 border-amber-200 overflow-hidden">
                {activeSharedRequest.driverPhoto ? (
                  <img src={`${API_URL}/${activeSharedRequest.driverPhoto.replace(/\\/g, '/')}`} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = activeSharedRequest.driverName?.[0] || 'D'; }} />
                ) : (
                  activeSharedRequest.driverName?.[0] || 'D'
                )}
              </div>
              <div>
                <p className="m-0 font-bold text-[#1A1A1A]">{activeSharedRequest.driverName || 'Driver'}</p>
                <p className="m-0 text-xs text-[#8B8B9E]">Your driver</p>
              </div>
            </div>

            <div className="space-y-3 mb-5 pb-5 border-b border-[#F0E0E8]">
              <div className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                <div className="text-sm"><span className="text-[#8B8B9E]">Your Pickup </span><span className="font-medium text-[#1A1A1A]"><AddressLabel address={activeSharedRequest.pickupAddress} lat={activeSharedRequest.pickupLat} lng={activeSharedRequest.pickupLng} /></span></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <div className="text-sm"><span className="text-[#8B8B9E]">Your Drop-off </span><span className="font-medium text-[#1A1A1A]"><AddressLabel address={activeSharedRequest.dropoffAddress} lat={activeSharedRequest.dropoffLat} lng={activeSharedRequest.dropoffLng} /></span></div>
              </div>
              {activeSharedRequest.trip?.departureTime && (
                <p className="text-xs text-[#8B8B9E] m-0 ml-5">Departure: {new Date(activeSharedRequest.trip.departureTime).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>

            <div className="mb-5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                {activeSharedRequest.trip?.availableSeats} {activeSharedRequest.trip?.availableSeats === 1 ? 'seat' : 'seats'} left
              </span>
            </div>

            <div className="mb-5 rounded-xl overflow-hidden border border-[#F0E0E8]">
              <RideRouteMap
                pickup={{ lat: activeSharedRequest.trip?.pickupLat, lng: activeSharedRequest.trip?.pickupLng }}
                dropoff={{ lat: activeSharedRequest.trip?.dropoffLat, lng: activeSharedRequest.trip?.dropoffLng }}
                secondaryPickup={{ lat: activeSharedRequest.pickupLat, lng: activeSharedRequest.pickupLng }}
                secondaryDropoff={{ lat: activeSharedRequest.dropoffLat, lng: activeSharedRequest.dropoffLng }}
                height="180px"
              />
            </div>

            <button
              className="w-36 bg-amber-500 text-white font-bold text-sm py-3.5 rounded-xl hover:bg-amber-600 transition cursor-pointer border-none shadow-sm"
              onClick={() => navigate(`/shared-trip/${activeSharedRequest.id}`)}
            >
              View Shared Trip
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] p-8 lg:p-10 text-center mb-7 shadow-sm">
          <div className="mx-auto mb-6 w-28 h-28 bg-[#FCE4EC] rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-[#E91E8C]" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 24h4l4-8h22l4 8h4v6h-4a4 4 0 01-8 0H18a4 4 0 01-8 0H5v-6z" /><circle cx="14" cy="34" r="3" /><circle cx="34" cy="34" r="3" /><path d="M13 16l-2 4" /><path d="M22 24l3-6 3 6" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#880E4F] m-0 mb-2">Where to?</h2>
          <p className="text-sm text-[#8B8B9E] m-0 mb-8 max-w-md mx-auto leading-relaxed">Book a ride to your destination. Select your pickup and drop-off locations, verify with a selfie, and you're on your way.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="bg-[#E91E8C] text-white font-bold text-sm py-3.5 px-8 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none shadow-sm" onClick={() => navigate('/ride/request')}>Request a Ride</button>
            <button className="bg-white text-[#880E4F] font-semibold text-sm py-3.5 px-8 rounded-xl border-2 border-[#F0E0E8] hover:border-[#E91E8C] hover:bg-[#FCE4EC] transition cursor-pointer" onClick={() => navigate('/ride/request')}>Enter Destination</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-8">
        <button onClick={() => navigate('/ride/request')} className="bg-white rounded-2xl border border-[#F0E0E8] p-5 text-center hover:border-[#E91E8C] hover:shadow-sm transition cursor-pointer">
          <svg className="w-7 h-7 text-[#E91E8C] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 17h14M5 12h14M5 7h14" /></svg>
          <span className="text-xs font-bold text-[#880E4F] uppercase tracking-wider">Book</span>
        </button>
        <button onClick={() => navigate('/passenger?tab=history')} className="bg-white rounded-2xl border border-[#F0E0E8] p-5 text-center hover:border-[#E91E8C] hover:shadow-sm transition cursor-pointer">
          <svg className="w-7 h-7 text-[#E91E8C] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          <span className="text-xs font-bold text-[#880E4F] uppercase tracking-wider">History</span>
        </button>
        <button onClick={() => navigate('/wallet')} className="bg-white rounded-2xl border border-[#F0E0E8] p-5 text-center hover:border-[#E91E8C] hover:shadow-sm transition cursor-pointer">
          <svg className="w-7 h-7 text-[#E91E8C] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M16 12a2 2 0 114 0 2 2 0 01-4 0" /></svg>
          <span className="text-xs font-bold text-[#880E4F] uppercase tracking-wider">Wallet</span>
        </button>
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-4">Recent Rides</h3>
          <div className="space-y-2">
            {history.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-[#F0E0E8] p-4 flex items-center gap-4 hover:border-[#E91E8C] hover:bg-[#FFF8FA] transition cursor-pointer" onClick={() => navigate(`/ride/${r.id}`)}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : r.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-amber-50 text-amber-600'}`}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    {r.status === 'completed' ? <path d="M20 6L9 17l-5-5" /> : r.status === 'cancelled' ? <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></> : <path d="M12 6v6l4 2" />}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1A1A1A] m-0 truncate"><AddressLabel address={r.pickupAddress} lat={r.pickupLat} lng={r.pickupLng} /></p>
                  <p className="text-xs text-[#8B8B9E] m-0 truncate"><AddressLabel address={r.dropoffAddress} lat={r.dropoffLat} lng={r.dropoffLng} /></p>
                  <p className="text-[0.6rem] text-[#B0B0C0] m-0 mt-0.5">{r.distance ? `${r.distance} km` : ''}{r.fare ? ` · ${r.fare} PKR` : ''} · {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <svg className="w-4 h-4 text-[#B0B0C0] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PassengerHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const views = {
    dashboard: {
      label: 'Dashboard',
      subtitle: 'Your ride overview',
      icon: 'dashboard',
      component: DashboardView,
    },
    book: {
      label: 'Book a Ride',
      subtitle: 'Request a new ride',
      icon: 'carPlus',
      component: () => {
        const RideSheet = () => (
          <div className="p-5 lg:p-8 w-1/2">
            <div className="bg-white rounded-2xl border border-[#F0E0E8] p-8 text-center shadow-sm">
              <div className="mx-auto mb-5 w-20 h-20 bg-[#FCE4EC] rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-[#E91E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 17h14M5 12h14M5 7h14" /></svg>
              </div>
              <h2 className="text-xl font-bold text-[#880E4F] m-0 mb-2">Book a Ride</h2>
              <p className="text-sm text-[#8B8B9E] m-0 mb-6">Set your pickup and destination to find nearby drivers.</p>
              <button className="bg-[#E91E8C] text-white font-bold text-sm py-3 px-8 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none" onClick={() => navigate('/ride/request')}>
                Open Booking Page →
              </button>
            </div>
          </div>
        );
        return <RideSheet />;
      },
    },
    history: {
      label: 'History',
      subtitle: 'Your ride history',
      icon: 'clock',
      component: () => {
        const [rides, setRides] = useState([]);
        const [loading, setLoading] = useState(true);
        useEffect(() => {
          rideAPI.getHistory().then(r => setRides(r.data.data.rides)).catch(() => { }).finally(() => setLoading(false));
        }, []);
        if (loading) return <div className="p-5 lg:p-8 animate-pulse"><div className="h-8 bg-gray-200 rounded-lg w-1/3" /></div>;
        return (
          <div className="p-5 lg:p-8 max-w-4xl w-full">
            <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-4">All Rides</h3>
            {rides.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 text-center">
                <svg className="w-12 h-12 text-[#B0B0C0] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                <p className="text-sm text-[#8B8B9E] m-0">No ride history yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rides.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-[#F0E0E8] p-4 flex items-center gap-4 hover:border-[#E91E8C] hover:bg-[#FFF8FA] transition cursor-pointer" onClick={() => navigate(`/ride/${r.id}`)}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : r.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-amber-50 text-amber-600'}`}>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{r.status === 'completed' ? <path d="M20 6L9 17l-5-5" /> : r.status === 'cancelled' ? <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></> : <path d="M12 6v6l4 2" />}</svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A1A] m-0 truncate"><AddressLabel address={r.pickupAddress} lat={r.pickupLat} lng={r.pickupLng} /></p>
                      <p className="text-xs text-[#8B8B9E] m-0 truncate"><AddressLabel address={r.dropoffAddress} lat={r.dropoffLat} lng={r.dropoffLng} /></p>
                      <p className="text-[0.6rem] text-[#B0B0C0] m-0 mt-0.5">{r.distance ? `${r.distance} km · ` : ''}{r.fare ? `${r.fare} PKR · ` : ''}{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[0.55rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : r.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-amber-50 text-amber-600'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    'my-shared-trips': {
      label: 'My Shared Trips',
      subtitle: 'Your shared trip requests',
      icon: 'carPlus',
      component: () => {
        const [requests, setRequests] = useState([]);
        const [loading, setLoading] = useState(true);
        const navigateHub = useNavigate();

        useEffect(() => {
          let cancelled = false;
          sharedTripAPI.getMyRequests()
            .then(res => { if (!cancelled) setRequests(res.data.data.requests || []); })
            .catch(() => { if (!cancelled) setRequests([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
          return () => { cancelled = true; };
        }, []);

        useEffect(() => {
          if (!socket) return;
          const refresh = () => {
            sharedTripAPI.getMyRequests()
              .then(res => setRequests(res.data.data.requests || []))
              .catch(() => { });
          };
          socket.on(SERVER_EVENTS.TRIP_REQUEST_ACCEPTED, refresh);
          socket.on(SERVER_EVENTS.TRIP_REQUEST_DECLINED, refresh);
          socket.on(SERVER_EVENTS.TRIP_CANCELLED, refresh);
          socket.on(SERVER_EVENTS.PASSENGER_JOINED, refresh);
          socket.on(SERVER_EVENTS.PASSENGER_LEFT, refresh);
          socket.on(SERVER_EVENTS.PASSENGER_REMOVED, refresh);
          return () => {
            socket.off(SERVER_EVENTS.TRIP_REQUEST_ACCEPTED, refresh);
            socket.off(SERVER_EVENTS.TRIP_REQUEST_DECLINED, refresh);
            socket.off(SERVER_EVENTS.TRIP_CANCELLED, refresh);
            socket.off(SERVER_EVENTS.PASSENGER_JOINED, refresh);
            socket.off(SERVER_EVENTS.PASSENGER_LEFT, refresh);
            socket.off(SERVER_EVENTS.PASSENGER_REMOVED, refresh);
          };
        }, [socket]);

        if (loading) return <div className="p-5 lg:p-8 animate-pulse"><div className="h-8 bg-gray-200 rounded-lg w-1/3" /></div>;

        const statusBadge = (status) => {
          const map = {
            pending: 'bg-amber-50 text-amber-700',
            accepted: 'bg-emerald-50 text-emerald-700',
            declined: 'bg-red-50 text-red-600',
            cancelled: 'bg-gray-100 text-gray-400',
          };
          return map[status] || 'bg-gray-50 text-gray-600';
        };

        return (
          <div className="p-5 lg:p-8 max-w-4xl w-full">
            <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-4">My Shared Trip Requests</h3>
            {requests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 text-center shadow-sm">
                <div className="mx-auto mb-4 w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 14l2-5h14l2 5" /><path d="M5 14v3a1 1 0 001 1h2a1 1 0 001-1v-1" /><path d="M15 17a1 1 0 001 1h2a1 1 0 001-1v-1" /></svg>
                </div>
                <h3 className="text-lg font-bold text-[#880E4F] m-0 mb-2">No Shared Trip Requests</h3>
                <p className="text-sm text-[#8B8B9E] m-0 max-w-sm mx-auto">You haven't requested to join any shared trips yet. Browse available shared trips to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm hover:border-[#E91E8C] hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigateHub(`/shared-trip/${r.id}`)}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-lg font-bold text-amber-600 flex-shrink-0 border-2 border-amber-200 overflow-hidden">
                            {r.driverPhoto ? (
                              <img src={`${API_URL}/${r.driverPhoto.replace(/\\/g, '/')}`} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = r.driverName?.[0] || 'D'; }} />
                            ) : (
                              r.driverName?.[0] || 'D'
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#1A1A1A] m-0">{r.driverName || 'Driver'}</p>
                            <p className="text-xs text-[#8B8B9E] m-0">{r.trip?.pickupAddress ? 'Shared trip' : ''}</p>
                          </div>
                        </div>
                        <span className={`text-[0.55rem] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="bg-[#FFF8FA] rounded-xl px-4 py-3 space-y-2 mb-2">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                          <span className="truncate text-[#1A1A1A]"><AddressLabel address={r.pickupAddress} lat={r.pickupLat} lng={r.pickupLng} /></span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="truncate text-[#1A1A1A]"><AddressLabel address={r.dropoffAddress} lat={r.dropoffLat} lng={r.dropoffLng} /></span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-[#8B8B9E]">
                          {r.trip?.pricePerSeat && <span className="font-semibold text-amber-700">{r.trip.pricePerSeat} PKR/seat</span>}
                          {r.trip?.departureTime && <span>{new Date(r.trip.departureTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        <svg className="w-4 h-4 text-[#B0B0C0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    wallet: {
      label: 'Wallet',
      subtitle: 'Your balance & transactions',
      icon: 'wallet',
      component: () => {
        const [bal, setBal] = useState(null);
        const [txns, setTxns] = useState([]);
        console.log(txns, "on line 291 PassengerHub");
        const [loading, setLoading] = useState(true);
        useEffect(() => {
          Promise.all([
            walletAPI.getWallet().catch(() => ({ data: { data: { wallet: { balance: 0 } } } })),
            walletAPI.getTransactions({ limit: 20 }).catch(() => ({ data: { data: { transactions: [] } } })),
          ]).then(([w, t]) => { setBal(w.data.data.wallet.balance); setTxns(t.data.data.transactions); }).finally(() => setLoading(false));
        }, []);
        if (loading) return <div className="p-5 lg:p-8 animate-pulse"><div className="h-8 bg-gray-200 rounded-lg w-1/3" /></div>;
        return (
          <div className="p-5 lg:p-8 max-w-3xl w-full">
            <div className="flex items-center justify-between bg-white rounded-2xl border border-[#F0E0E8] p-6 mb-6 shadow-sm">
              <div>
                <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Wallet Balance</p>
                <p className="text-3xl font-bold text-emerald-700 m-0 font-mono">{parseFloat(bal).toFixed(0)} PKR</p>
              </div>
              <div>
                <button className="mt-4 bg-[#E91E8C] text-white font-bold text-sm py-2.5 px-6 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none" onClick={() => navigate('/wallet')}>Top Up</button>
              </div>
            </div>
            <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-4">Transactions</h3>
            {txns.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#F0E0E8] p-8 text-center"><p className="text-sm text-[#8B8B9E] m-0">No transactions yet.</p></div>
            ) : (
              <div className="space-y-1.5">
                {txns.map((t) => (
                  <div key={t.id} className="bg-white border border-[#F0E0E8] rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] m-0 truncate">{t.description || t.type}</p>
                      <p className="text-[0.6rem] text-[#B0B0C0] m-0">{new Date(t.createdAt).toLocaleDateString()} · {t.type}</p>
                    </div>
                    <span className={`font-mono text-sm font-bold ml-3 ${t.direction === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.direction === 'credit' ? '+' : '-'}{parseFloat(t.amount).toLocaleString()} PKR
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    emergency: {
      label: 'Emergency',
      subtitle: 'Emergency contacts',
      icon: 'shield',
      component: () => {
        const [contacts, setContacts] = useState([]);
        const [loading, setLoading] = useState(true);
        useEffect(() => {
          sosAPI.getContacts().then(r => setContacts(r.data.data.contacts || [])).catch(() => { }).finally(() => setLoading(false));
        }, []);
        if (loading) return <div className="p-5 lg:p-8 animate-pulse"><div className="h-8 bg-gray-200 rounded-lg w-1/3" /></div>;
        return (
          <div className="p-5 lg:p-8 max-w-2xl">
            <div className="bg-white rounded-2xl border border-[#F0E0E8] p-6 shadow-sm mb-4">
              <p className="text-sm text-[#8B8B9E] m-0 mb-4">Emergency contacts will be notified when you trigger the SOS button during a ride.</p>
              {contacts.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-10 h-10 text-[#B0B0C0] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  <p className="text-sm text-[#8B8B9E] m-0">No emergency contacts added.</p>
                  <button className="mt-4 bg-[#E91E8C] text-white font-bold text-sm py-2.5 px-6 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none" onClick={() => navigate('/emergency-contacts')}>Add Contacts</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div key={c.id} className="bg-[#FFF8FA] rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-[#1A1A1A]">{c.name} · {c.phone}</span>
                      <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-[#FCE4EC] text-[#E91E8C] uppercase tracking-wider">{c.relation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
  };

  const defaultTab = tabParam && views[tabParam] ? tabParam : 'dashboard';
  return <DashboardLayout views={views} defaultTab={defaultTab} />;
}

export default PassengerHub;
