import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function PassengerDashboard() {
  const [activeRide, setActiveRide] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const navigate = useNavigate();

  const fetch = useCallback(async (mounted = true) => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        rideAPI.getActiveRide(),
        rideAPI.getHistory().catch(() => ({ data: { data: { rides: [] } } })),
      ]);
      if (mounted) {
        const active = activeRes.data.data;
        setActiveRide(active.ride);
        setActiveDriver(active.driver);
        setHistory(historyRes.data.data.rides.slice(0, 5));
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
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetch]);

  useEffect(() => {
    if (!socket || !activeRide) return;
    socket.emit('join:ride', activeRide.id);
    const handler = () => fetch(true);
    socket.on('ride:status', handler);
    return () => {
      socket.emit('leave:ride', activeRide.id);
      socket.off('ride:status', handler);
    };
  }, [socket, activeRide?.id]);

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

  if (loading) return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;

  const statusDisplay = {
    pending: 'Looking for a driver...',
    accepted: 'Driver on the way!',
    arrived: 'Driver arrived!',
    in_progress: 'On your way!',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Passenger</h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">{user?.name || 'Welcome'}</p>
      </div>

      {activeRide ? (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-plum mb-3 tracking-[-0.01em] m-0">Current Ride</h3>
          <div className="bg-white border border-border rounded p-5">
            <div className="mb-2">
              <span className={badgeClass(activeRide.status)}>{activeRide.status}</span>
            </div>
            <p className="font-display text-lg font-semibold text-plum m-0 mb-4">{statusDisplay[activeRide.status]}</p>

            {activeDriver && (
              <div className="flex items-center gap-4 mb-4 p-3 bg-off-white rounded-sm">
                {activeDriver.profilePhoto ? (
                  <img
                    src={`${API_URL}/${activeDriver.profilePhoto.replace(/\\/g, '/')}`}
                    alt={activeDriver.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-border"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-pink-subtle flex items-center justify-center text-lg text-pink">
                    {activeDriver.name?.[0] || 'D'}
                  </div>
                )}
                <div>
                  <p className="m-0 font-semibold text-plum text-[0.95rem]">{activeDriver.name}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 mb-4">
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
            <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" onClick={() => navigate('/ride/active')}>
              View Details
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 bg-white border border-border rounded">
          <div className="text-5xl mb-4">&#128663;</div>
          <h2 className="font-display text-[1.8rem] font-bold text-plum m-0 mb-2 tracking-[-0.02em]">Where to?</h2>
          <p className="text-[0.95rem] text-text-muted mx-auto mb-6 max-w-[320px] leading-[1.6] m-0 mb-6">Book a ride to get started. Select your pickup and drop-off locations, verify with a selfie, and you are on your way.</p>
          <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none px-8 py-3.5 text-base rounded" onClick={() => navigate('/ride/request')}>
            Request a Ride
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-plum mb-3 tracking-[-0.01em] m-0">Recent Rides</h3>
          <div className="flex flex-col gap-1.5">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-white border border-border rounded-sm cursor-pointer" onClick={() => navigate(`/ride/${r.id}`)}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-plum">
                    {r.driver ? `${r.driver.name} · ` : ''}{r.pickupAddress || `${r.pickupLat?.toFixed(2)}, ${r.pickupLng?.toFixed(2)}`} &rarr; {r.dropoffAddress || `${r.dropoffLat?.toFixed(2)}, ${r.dropoffLng?.toFixed(2)}`}
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

export default PassengerDashboard;
