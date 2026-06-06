import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function PassengerDashboard() {
  const [activeRide, setActiveRide] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
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

            {activeDriver && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--off-white)', borderRadius: 'var(--radius-sm)' }}>
                {activeDriver.profilePhoto ? (
                  <img
                    src={`${API_URL}/${activeDriver.profilePhoto.replace(/\\/g, '/')}`}
                    alt={activeDriver.name}
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--pink-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: 'var(--pink)' }}>
                    {activeDriver.name?.[0] || 'D'}
                  </div>
                )}
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--plum)', fontSize: '0.95rem' }}>{activeDriver.name}</p>
                </div>
              </div>
            )}

            <div className="ride-card-details">
              <div className="ride-detail">
                <span className="ride-detail-label">Pickup</span>
                <span className="ride-detail-value">{activeRide.pickupAddress || `${activeRide.pickupLat?.toFixed(4)}, ${activeRide.pickupLng?.toFixed(4)}`}</span>
              </div>
              <div className="ride-detail">
                <span className="ride-detail-label">Drop-off</span>
                <span className="ride-detail-value">{activeRide.dropoffAddress || `${activeRide.dropoffLat?.toFixed(4)}, ${activeRide.dropoffLng?.toFixed(4)}`}</span>
              </div>
              {activeRide.distance && (
                <div className="ride-detail">
                  <span className="ride-detail-label">Distance</span>
                  <span className="ride-detail-value">{activeRide.distance} km</span>
                </div>
              )}
              {activeRide.fare > 0 && (
                <div className="ride-detail">
                  <span className="ride-detail-label">Fare</span>
                  <span className="ride-detail-value" style={{ fontWeight: 700 }}>{activeRide.fare} PKR</span>
                </div>
              )}
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
              <div key={r.id} className="history-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/ride/${r.id}`)}>
                <div className="history-row-left">
                  <span className="history-route">
                    {r.driver ? `${r.driver.name} · ` : ''}{r.pickupAddress || `${r.pickupLat?.toFixed(2)}, ${r.pickupLng?.toFixed(2)}`} &rarr; {r.dropoffAddress || `${r.dropoffLat?.toFixed(2)}, ${r.dropoffLng?.toFixed(2)}`}
                  </span>
                  <span className="history-date">
                    {r.distance ? `${r.distance} km · ` : ''}{r.fare ? `${r.fare} PKR · ` : ''}{new Date(r.createdAt).toLocaleDateString()}
                  </span>
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
