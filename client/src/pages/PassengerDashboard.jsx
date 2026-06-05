import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

function PassengerDashboard() {
  const [activeRide, setActiveRide] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const [activeRes, historyRes] = await Promise.all([
          rideAPI.getActiveRide(),
          rideAPI.getHistory().catch(() => ({ data: { data: { rides: [] } } })),
        ]);
        if (mounted) {
          setActiveRide(activeRes.data.data.ride);
          setHistory(historyRes.data.data.rides.slice(0, 5));
        }
      } catch {
        // no active ride
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const statusDisplay = {
    pending: 'Looking for a driver...',
    accepted: 'Driver on the way!',
    arrived: 'Driver arrived!',
    in_progress: 'On your way!',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Passenger</h1>
        <p className="page-subtitle">{user?.name || 'Welcome'}</p>
      </div>

      {activeRide ? (
        <div className="section">
          <h3 className="section-title">Current Ride</h3>
          <div className="ride-card">
            <div className="ride-card-top">
              <span className={`badge badge--${activeRide.status}`}>{activeRide.status}</span>
            </div>
            <p className="ride-card-status">{statusDisplay[activeRide.status]}</p>
            <div className="ride-card-details">
              <div className="ride-detail">
                <span className="ride-detail-label">Pickup</span>
                <span className="ride-detail-value">{activeRide.pickupLat?.toFixed(4)}, {activeRide.pickupLng?.toFixed(4)}</span>
              </div>
              <div className="ride-detail">
                <span className="ride-detail-label">Drop-off</span>
                <span className="ride-detail-value">{activeRide.dropoffLat?.toFixed(4)}, {activeRide.dropoffLng?.toFixed(4)}</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/ride/active')}>
              View Details
            </button>
          </div>
        </div>
      ) : (
        <div className="hero-card">
          <div className="hero-card-emblem">🚗</div>
          <h2 className="hero-card-title">Where to?</h2>
          <p className="hero-card-text">Book a ride to get started. Select your pickup and drop-off locations, verify with a selfie, and you are on your way.</p>
          <button className="btn btn-primary btn-large" onClick={() => navigate('/ride/request')}>
            Request a Ride
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="section">
          <h3 className="section-title">Recent Rides</h3>
          <div className="history-list">
            {history.map((r) => (
              <div key={r.id} className="history-row">
                <div className="history-row-left">
                  <span className="history-route">{r.pickupLat?.toFixed(2)}, {r.pickupLng?.toFixed(2)} &rarr; {r.dropoffLat?.toFixed(2)}, {r.dropoffLng?.toFixed(2)}</span>
                  <span className="history-date">{new Date(r.createdAt).toLocaleDateString()}</span>
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

export default PassengerDashboard;
