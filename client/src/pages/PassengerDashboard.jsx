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
    return () => { mounted = false; clearInterval(interval); };
  }, [fetch]);

  useEffect(() => {
    if (!socket || !activeRide) return;
    socket.emit('join:ride', activeRide.id);
    const handler = () => fetch(true);
    socket.on('ride:status', handler);
    return () => { socket.emit('leave:ride', activeRide.id); socket.off('ride:status', handler); };
  }, [socket, activeRide?.id]);

  const statusDisplay = {
    pending: 'Looking for a driver...',
    accepted: 'Driver on the way!',
    arrived: 'Driver arrived!',
    in_progress: 'On your way!',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  const badgeClass = (status) => {
    const colors = {
      approved: 'badge-success', rejected: 'badge-error', pending: 'badge-warning',
      accepted: 'badge-info', arrived: 'badge-info', in_progress: 'badge-info',
      completed: 'badge-success', cancelled: 'badge-neutral',
    };
    return `badge ${colors[status] || 'badge-warning'}`;
  };

  if (loading) return <div className="page"><div className="space-y-3"><div className="loading-skeleton h-8 w-1/3" /><div className="loading-skeleton h-4 w-2/3" /><div className="loading-skeleton h-32" /></div></div>;

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0] || 'there'}</h1>
        <p>Ready for your next ride?</p>
      </div>

      {activeRide ? (
        <div className="mt-6">
          <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Current Ride</h3>
          <div className="card p-5">
            <div className="mb-2"><span className={badgeClass(activeRide.status)}>{activeRide.status}</span></div>
            <p className="font-display text-lg font-semibold text-navy m-0 mb-4">{statusDisplay[activeRide.status]}</p>

            {activeDriver && (
              <div className="flex items-center gap-4 mb-4 p-3 bg-ivory rounded-sm">
                {activeDriver.profilePhoto ? (
                  <img src={`${API_URL}/${activeDriver.profilePhoto.replace(/\\/g, '/')}`} alt={activeDriver.name} className="w-12 h-12 rounded-full object-cover border-2 border-border" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-coral-light flex items-center justify-center text-lg text-coral">{activeDriver.name?.[0] || 'D'}</div>
                )}
                <div><p className="m-0 font-semibold text-navy text-[0.95rem]">{activeDriver.name}</p></div>
              </div>
            )}

            <div className="flex flex-col gap-2 mb-4">
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
            <button className="btn btn-primary" onClick={() => navigate('/ride/active')}>View Details</button>
          </div>
        </div>
      ) : (
        <div className="empty-state mt-6">
          <div className="empty-state-icon">&#128663;</div>
          <h3>Where to?</h3>
          <p>Book a ride to get started. Select your pickup and drop-off locations, verify with a selfie, and you're on your way.</p>
          <button className="btn btn-primary btn-lg mt-4" onClick={() => navigate('/ride/request')}>Request a Ride</button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Recent Rides</h3>
          <div className="flex flex-col gap-1.5">
            {history.map((r) => (
              <div key={r.id} className="card-list card-list-hover flex items-center justify-between" onClick={() => navigate(`/ride/${r.id}`)}>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-medium text-navy truncate">
                    {r.driver ? `${r.driver.name} · ` : ''}{r.pickupAddress || `${r.pickupLat?.toFixed(2)}, ${r.pickupLng?.toFixed(2)}`} &rarr; {r.dropoffAddress || `${r.dropoffLat?.toFixed(2)}, ${r.dropoffLng?.toFixed(2)}`}
                  </span>
                  <span className="text-xs text-stone-light">{r.distance ? `${r.distance} km · ` : ''}{r.fare ? `${r.fare} PKR · ` : ''}{new Date(r.createdAt).toLocaleDateString()}</span>
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
