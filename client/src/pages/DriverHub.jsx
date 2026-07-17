import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { driverAPI, walletAPI, sharedTripAPI } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import { useSocket } from '../context/SocketContext';
import { CLIENT_EVENTS } from '../constants/socketEvents';
import DriverRides from './DriverRides';
import DriverEarnings from './DriverEarnings';
import DriverWithdraw from './DriverWithdraw';
import DriverVerification from './DriverVerification';
import DeclineReasonModal from '../components/DeclineReasonModal';
import RideRouteMap from '../components/RideRouteMap';

const StatusIcon = ({ name, className = 'w-7 h-7' }) => {
  const icons = {
    clipboard: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 13l2 2 4-4" /></svg>,
    clock: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
    fileEdit: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M12 18l-3-3 1.5-1.5" /></svg>,
    checkCircle: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>,
  };
  return icons[name] || null;
};

function DashboardView() {
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [sharedTrips, setSharedTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const [verRes, walRes, tripRes] = await Promise.all([
          driverAPI.getStatus(),
          walletAPI.getWithdrawable().catch(() => null),
          sharedTripAPI.getMyTrips().catch(() => ({ data: { data: { trips: [] } } })),
        ]);
        if (mounted) {
          setData(verRes.data.data);
          setWallet(walRes?.data?.data || null);
          setSharedTrips(tripRes.data.data.trips || []);
        }
      } catch {
        if (mounted) setData({ status: 'not_submitted', documents: [], isDriverVerified: false });
      } finally { if (mounted) setLoading(false); }
    };
    fetch();
    return () => { mounted = false; };
  }, []);

  const STATES = {
    not_submitted: { icon: 'clipboard', title: 'Get verified to start earning', desc: 'Upload your documents and complete the verification process to start accepting rides.', action: 'Upload Documents', path: '/driver/verification' },
    pending: { icon: 'clock', title: 'Under review', desc: 'Your documents are being reviewed. We will notify you once you\'re verified.', action: null, path: null },
    rejected: { icon: 'fileEdit', title: 'Changes needed', desc: 'Some documents were not approved. Check the feedback and re-upload.', action: 'Re-upload', path: '/driver/verification' },
    approved: { icon: 'checkCircle', title: 'You\'re verified!', desc: 'All documents approved. You can now accept rides and start earning.', action: 'Find Rides', path: '/driver/rides' },
  };

  if (loading) return <div className="p-5 lg:p-8 animate-pulse space-y-4 max-w-4xl"><div className="h-8 bg-gray-200 rounded-lg w-1/2" /><div className="h-48 bg-gray-200 rounded-2xl" /></div>;

  const s = STATES[data?.status] || STATES.not_submitted;
  const isVerified = data?.status === 'approved';

  return (
    <div className="p-5 lg:p-8 max-w-4xl w-full">
      {!isVerified && (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] p-6 lg:p-7 mb-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[#FCE4EC] flex items-center justify-center flex-shrink-0">
              <StatusIcon name={s.icon} className="w-7 h-7 text-[#E91E8C]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[#880E4F] m-0 mb-1">{s.title}</h2>
              <p className="text-sm text-[#8B8B9E] m-0 mb-4 leading-relaxed">{s.desc}</p>
              {s.action && <button className="bg-[#E91E8C] text-white font-bold text-sm py-2.5 px-6 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none" onClick={() => navigate(s.path)}>{s.action}</button>}
            </div>
          </div>
          {data?.documents?.length > 0 && (
            <div className="mt-5 pt-5 border-t border-[#F0E0E8]">
              <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-3">Documents</p>
              <div className="space-y-2">
                {data.documents.map((doc) => (
                  <div key={doc.id}>
                    <div className="flex items-center justify-between py-2.5 px-4 bg-[#FFF8FA] rounded-xl">
                      <span className="text-sm font-medium text-[#1A1A1A]">{doc.documentType === 'license' ? "Driver's License" : doc.documentType === 'registration' ? 'Vehicle Registration' : 'Profile Photo'}</span>
                      <span className={`text-[0.55rem] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : doc.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{doc.status}</span>
                    </div>
                    {doc.status === 'rejected' && doc.adminNote && <p className="text-xs text-red-500 m-0 mt-0.5 px-4">{doc.adminNote}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {wallet && isVerified && (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {isVerified && (
                  <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[0.55rem] font-bold text-emerald-700 uppercase tracking-wider">Online</span>
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="bg-[#FFF8FA] rounded-xl p-5">
                <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Wallet Balance</p>
                <p className="text-2xl font-bold text-emerald-700 m-0 font-mono">{wallet.walletBalance.toFixed(0)} PKR</p>
              </div>
              <div className="bg-[#FFF8FA] rounded-xl p-5">
                <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Total Earnings</p>
                <p className="text-2xl font-bold text-[#880E4F] m-0 font-mono">{wallet.totalEarnings.toFixed(0)} PKR</p>
              </div>
            </div>
            <div className="space-y-3">
              {parseFloat(wallet.commissionDue) > 0 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    <span className="text-xs font-semibold text-amber-700">Commission Due</span>
                  </div>
                  <span className="text-sm font-bold text-amber-700 font-mono">{wallet.commissionDue.toFixed(0)} PKR</span>
                </div>
              )}
              <div className="flex items-center justify-between px-1 py-2">
                <span className="text-xs text-[#8B8B9E]">Withdrawable</span>
                <span className="text-sm font-bold text-[#1A1A1A] font-mono">{wallet.withdrawable.toFixed(0)} PKR</span>
              </div>
              <div className="flex items-center justify-between px-1 py-2 border-t border-[#F0E0E8]">
                <span className="text-xs text-[#8B8B9E]">Total Withdrawn</span>
                <span className="text-sm font-bold text-[#1A1A1A] font-mono">{wallet.totalWithdrawn.toFixed(0)} PKR</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isVerified && (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-6">
          <div className="px-5 py-4 border-b border-[#F0E0E8] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0">Your Shared Trips</h3>
            <button onClick={() => navigate('/driver/dashboard?tab=trip-requests')} className="text-[0.55rem] font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full hover:bg-amber-100 transition cursor-pointer border-none">
              View Requests
            </button>
          </div>
          <div className="divide-y divide-[#F0E0E8]">
            {sharedTrips.length === 0 ? (
              <div className="px-5 py-8 text-center text-[#8B8B9E] text-sm">
                You haven’t created any trips yet.
              </div>
            ) : (() => {
              const activeTrips = sharedTrips.filter(t => t.status === 'active' || t.status === 'full');
              if (activeTrips.length === 0) {
                return (
                  <div className="px-5 py-8 text-center text-[#8B8B9E] text-sm">
                    No active trips available.
                  </div>
                );
              }
              return activeTrips.map((trip) => (
                <div key={trip.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-[#FFF8FA] transition">
                  {/* trip item content as before */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 14l2-5h14l2 5" /><path d="M5 14v3a1 1 0 001 1h2a1 1 0 001-1v-1" /><path d="M15 17a1 1 0 001 1h2a1 1 0 001-1v-1" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A1A] m-0 truncate">{trip.pickupAddress || `${trip.pickupLat?.toFixed(4)}, ${trip.pickupLng?.toFixed(4)}`} → {trip.dropoffAddress || `${trip.dropoffLat?.toFixed(4)}, ${trip.dropoffLng?.toFixed(4)}`}</p>
                      <p className="text-[0.6rem] text-[#8B8B9E] m-0 mt-0.5">
                        {new Date(trip.departureTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {trip.availableSeats} {trip.availableSeats === 1 ? 'seat' : 'seats'} · {trip.pricePerSeat} PKR/seat
                      </p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[0.55rem] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${trip.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{trip.status}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
      {isVerified && (
        (() => {
          const activeTrip = sharedTrips.find(t => t.status === 'active' || t.status === 'full' || t.status === 'in_progress');
          if (!activeTrip) return null;
          return (
            <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-6">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0">Active Shared Trip</h3>
                  <span className={`text-[0.55rem] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${activeTrip.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {activeTrip.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-[#8B8B9E] mb-3">
                  {activeTrip.pickupAddress || `${activeTrip.pickupLat?.toFixed(4)}, ${activeTrip.pickupLng?.toFixed(4)}`} → {activeTrip.dropoffAddress || `${activeTrip.dropoffLat?.toFixed(4)}, ${activeTrip.dropoffLng?.toFixed(4)}`}
                </div>
                <div className="mb-3 rounded-xl overflow-hidden border border-[#F0E0E8]">
                  <RideRouteMap
                    pickup={{ lat: activeTrip.pickupLat, lng: activeTrip.pickupLng }}
                    dropoff={{ lat: activeTrip.dropoffLat, lng: activeTrip.dropoffLng }}
                    height="160px"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[#8B8B9E]">
                    <span className="font-bold text-[#1A1A1A]">{activeTrip.pricePerSeat} PKR</span> · {activeTrip.availableSeats} seats
                  </div>
                  <button
                    onClick={() => navigate(`/driver/shared-trip/${activeTrip.id}`)}
                    className="bg-amber-500 text-white font-bold text-xs py-2 px-5 rounded-xl hover:bg-amber-600 transition cursor-pointer border-none"
                  >
                    Manage Trip
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {isVerified && (
        <>
          <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => navigate('/driver/rides')} className="bg-white rounded-2xl border border-[#F0E0E8] p-6 text-left hover:border-[#E91E8C] hover:shadow-sm transition cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-[#FCE4EC] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#E91E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 17h14M5 12h14M5 7h14" /></svg>
              </div>
              <p className="text-base font-bold text-[#1A1A1A] m-0">Rides</p>
              <p className="text-sm text-[#8B8B9E] m-0 mt-0.5">Accept and manage ride requests</p>
            </button>
            <button onClick={() => navigate('/driver/create-trip')} className="bg-white rounded-2xl border border-[#F0E0E8] p-6 text-left hover:border-amber-400 hover:shadow-sm transition cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 14l2-5h14l2 5" /><path d="M5 14v3a1 1 0 001 1h2a1 1 0 001-1v-1" /><path d="M15 17a1 1 0 001 1h2a1 1 0 001-1v-1" /><path d="M18 9V7" /><path d="M16 8h4" /></svg>
              </div>
              <p className="text-base font-bold text-[#1A1A1A] m-0">Create Shared Trip</p>
              <p className="text-sm text-[#8B8B9E] m-0 mt-0.5">Offer seats along your route</p>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TripRequestsView() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [requests, setRequests] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [declineModal, setDeclineModal] = useState(null);
  const [profileModal, setProfileModal] = useState(null);
  const [error, setError] = useState('');
  const { socket } = useSocket();

  const fetchTrips = useCallback(async () => {
    try {
      const res = await sharedTripAPI.getMyTrips();
      const activeTrips = (res.data.data.trips || []).filter((t) => t.status === 'active' || t.status === 'full');
      setTrips(activeTrips);

      const reqMap = {};
      for (const trip of activeTrips) {
        try {
          const reqRes = await sharedTripAPI.getTripRequests(trip.id);
          reqMap[trip.id] = reqRes.data.data.requests || [];
        } catch {
          reqMap[trip.id] = [];
        }
      }
      setRequests(reqMap);
    } catch {
      setError('Failed to load trip requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  // Reconnect: re-fetch trips and re-emit trip:listen for real-time request notifications
  useEffect(() => {
    if (!socket) return;
    const onReconnect = () => {
      socket.emit(CLIENT_EVENTS.TRIP_LISTEN);
      fetchTrips();
    };
    socket.on('connect', onReconnect);
    return () => { socket.off('connect', onReconnect); };
  }, [socket]);

  const handleAccept = async (requestId) => {
    setActionLoading(requestId);
    setError('');
    try {
      await sharedTripAPI.acceptRequest(requestId);
      fetchTrips();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requestId, reason) => {
    setActionLoading(requestId);
    setError('');
    try {
      await sharedTripAPI.declineRequest(requestId, reason);
      setDeclineModal(null);
      fetchTrips();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to decline request.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-5 lg:p-8 animate-pulse space-y-4 max-w-4xl"><div className="h-8 bg-gray-200 rounded-lg w-1/3" /><div className="h-32 bg-gray-200 rounded-2xl" /></div>;

  const allRequests = Object.values(requests).flat();
  const hasRequests = allRequests.length > 0;

  return (
    <div className="p-5 lg:p-8 max-w-4xl w-full">
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {!hasRequests ? (
        trips.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M2 12h20" /></svg>
            </div>
            <h3 className="text-lg font-bold text-[#880E4F] m-0 mb-2">No Shared Trips Created</h3>
            <p className="text-sm text-[#8B8B9E] m-0 max-w-sm mx-auto mb-4">You haven't created any shared trips yet. Create your first trip to start receiving passenger requests.</p>
            <button
              onClick={() => navigate('/driver/create-trip')}
              className="px-6 py-2.5 bg-[#E91E8C] text-white font-semibold text-sm rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none"
            >
              Create a Trip
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 14l2-5h14l2 5" /><path d="M5 14v3a1 1 0 001 1h2a1 1 0 001-1v-1" /><path d="M15 17a1 1 0 001 1h2a1 1 0 001-1v-1" /></svg>
            </div>
            <h3 className="text-lg font-bold text-[#880E4F] m-0 mb-2">No Trip Requests Yet</h3>
            <p className="text-sm text-[#8B8B9E] m-0 max-w-sm mx-auto">When passengers request to join your shared trip, they'll appear here.</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const tripRequests = requests[trip.id] || [];
            if (tripRequests.length === 0) return null;
            return (
              <div key={trip.id} className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-gradient-to-r from-amber-50 via-white to-amber-50 border-b border-[#F0E0E8]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[0.55rem] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {trip.availableSeats} {trip.availableSeats === 1 ? 'seat' : 'seats'} left
                      </span>
                      <span className="text-[0.55rem] text-[#8B8B9E]">
                        {new Date(trip.departureTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 font-mono">{trip.pricePerSeat} PKR/seat</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-[#8B8B9E]">
                    <svg className="w-3 h-3 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="M5 17h14M5 12h14M5 7h14" /></svg>
                    <span className="truncate">{trip.pickupAddress || `${trip.pickupLat?.toFixed(4)}, ${trip.pickupLng?.toFixed(4)}`}</span>
                    <span>→</span>
                    <span className="truncate">{trip.dropoffAddress || `${trip.dropoffLat?.toFixed(4)}, ${trip.dropoffLng?.toFixed(4)}`}</span>
                  </div>
                </div>

                <div className="divide-y divide-[#F0E0E8]">
                  {tripRequests.map((req) => (
                    <div key={req.id} className="p-4 hover:bg-[#FFF8FA] transition">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-lg font-bold text-amber-600 flex-shrink-0 border-2 border-amber-200 overflow-hidden">
                          {req.passengerPhoto ? (
                            <img src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000'}/${req.passengerPhoto.replace(/\\/g, '/')}`} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = req.passengerName?.[0] || 'P'; }} />
                          ) : (
                            req.passengerName?.[0] || 'P'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#1A1A1A] m-0">{req.passengerName || 'Passenger'}</p>
                          <div className="flex items-center gap-2 text-xs text-[#8B8B9E] mt-0.5">
                            <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="M5 17h14M5 12h14M5 7h14" /></svg>
                            <span className="truncate">{req.pickupAddress || `${req.pickupLat?.toFixed(4)}, ${req.pickupLng?.toFixed(4)}`}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#8B8B9E] mt-0.5">
                            <svg className="w-3 h-3 text-[#1A1A1A] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="M5 17h14M5 12h14M5 7h14" /></svg>
                            <span className="truncate">{req.dropoffAddress || `${req.dropoffLat?.toFixed(4)}, ${req.dropoffLng?.toFixed(4)}`}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleAccept(req.id)}
                            disabled={actionLoading === req.id}
                            className="bg-emerald-500 text-white text-xs font-bold py-2 px-3.5 rounded-lg hover:bg-emerald-600 transition cursor-pointer border-none disabled:opacity-50 whitespace-nowrap"
                          >
                            {actionLoading === req.id ? '...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => setDeclineModal(req.id)}
                            disabled={actionLoading === req.id}
                            className="bg-red-50 text-red-600 text-xs font-bold py-2 px-3.5 rounded-lg hover:bg-red-100 transition cursor-pointer border-none disabled:opacity-50 whitespace-nowrap"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => setProfileModal(req)}
                            className="bg-[#FFF8FA] text-[#880E4F] text-xs font-semibold py-2 px-3 rounded-lg hover:bg-[#FCE4EC] transition cursor-pointer border border-[#F0E0E8] whitespace-nowrap"
                          >
                            Profile
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 h-32 rounded-xl overflow-hidden border border-[#F0E0E8]">
                        <RideRouteMap
                          pickup={{ lat: trip.pickupLat, lng: trip.pickupLng }}
                          dropoff={{ lat: trip.dropoffLat, lng: trip.dropoffLng }}
                          secondaryPickup={{ lat: req.pickupLat, lng: req.pickupLng }}
                          secondaryDropoff={{ lat: req.dropoffLat, lng: req.dropoffLng }}
                          passengerMarkers={[
                            { lat: req.pickupLat, lng: req.pickupLng, passengerPhoto: req.passengerPhoto, name: req.passengerName || 'Passenger' },
                          ]}
                          height="128px"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeclineReasonModal
        isOpen={declineModal !== null}
        onClose={() => setDeclineModal(null)}
        onSubmit={(reason) => handleDecline(declineModal, reason)}
      />

      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setProfileModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#880E4F] m-0">Passenger Profile</h3>
              <button onClick={() => setProfileModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FFF8FA] text-[#8B8B9E] transition cursor-pointer border-none bg-transparent">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-2xl font-bold text-amber-600 mb-3 border-2 border-amber-300 overflow-hidden">
                {profileModal.passengerPhoto ? (
                  <img src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000'}/${profileModal.passengerPhoto.replace(/\\/g, '/')}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  profileModal.passengerName?.[0] || 'P'
                )}
              </div>
              <p className="text-lg font-bold text-[#1A1A1A] m-0">{profileModal.passengerName || 'Passenger'}</p>
              {profileModal.passengerPhone && <p className="text-sm text-[#8B8B9E] m-0 mt-1">{profileModal.passengerPhone}</p>}
            </div>
            <div className="space-y-3">
              <div className="bg-[#FFF8FA] rounded-xl p-4">
                <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Pickup</p>
                <p className="text-sm text-[#1A1A1A] m-0">{profileModal.pickupAddress || `${profileModal.pickupLat?.toFixed(4)}, ${profileModal.pickupLng?.toFixed(4)}`}</p>
              </div>
              <div className="bg-[#FFF8FA] rounded-xl p-4">
                <p className="text-[0.55rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Dropoff</p>
                <p className="text-sm text-[#1A1A1A] m-0">{profileModal.dropoffAddress || `${profileModal.dropoffLat?.toFixed(4)}, ${profileModal.dropoffLng?.toFixed(4)}`}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverHub() {
  const [verData, setVerData] = useState(null);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    driverAPI.getStatus().then(r => setVerData(r.data.data)).catch(() => setVerData({ status: 'not_submitted', isDriverVerified: false }));
  }, []);
  const isVerified = verData?.status === 'approved';

  const verified = verData?.status === 'approved';

  const views = {
    dashboard: { label: 'Dashboard', subtitle: 'Earnings at a glance', icon: 'dashboard', component: DashboardView },
    rides: { label: 'Rides', subtitle: 'Accept and manage rides', icon: 'car', component: DriverRides },
    'trip-requests': { label: 'Trip Requests', subtitle: 'Passengers requesting seats', icon: 'carPlus', component: TripRequestsView },
    earnings: { label: 'Earnings', subtitle: 'Track your revenue', icon: 'chart', component: DriverEarnings },
    withdraw: { label: 'Withdraw', subtitle: 'Request a payout', icon: 'walletArrow', component: DriverWithdraw },
    documents: { label: 'Documents', subtitle: verified ? 'Verification approved' : 'Verification documents', icon: 'fileCheck', component: DriverVerification },
  };

  const tabParam = searchParams.get('tab');
  const validTabs = views;
  const defaultTab = tabParam && validTabs[tabParam] ? tabParam : 'dashboard';

  return (
    <DashboardLayout
      views={views}
      defaultTab={defaultTab}
    />
  );
}

export default DriverHub;
