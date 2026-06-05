import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';

function DriverRides() {
  const [pendingRides, setPendingRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
  const [activePassenger, setActivePassenger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [pendingRes, activeRes] = await Promise.all([
        rideAPI.getPendingRides().catch(() => ({ data: { data: { rides: [] } } })),
        rideAPI.getActiveRide(),
      ]);
      setPendingRides(pendingRes.data.data.rides);
      const active = activeRes.data.data;
      setActiveRide(active.ride);
      setActiveDriver(active.driver);
      setActivePassenger(active.passenger);
    } catch (err) {
      if (err.response?.status !== 403) {
        setError(err.response?.data?.message || 'Failed to load.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async (rideId) => {
    setMessage('');
    setError('');
    try {
      const res = await rideAPI.acceptRide(rideId);
      setMessage(res.data.message);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept.');
    }
  };

  const handleStatus = async (rideId, status) => {
    setMessage('');
    setError('');
    try {
      const res = await rideAPI.updateStatus(rideId, status);
      setMessage(res.data.message);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update.');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Rides</h1>
        <p className="page-subtitle">Accept and manage ride requests</p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      {activeRide && (
        <div className="section">
          <h3 className="section-title">Current Ride</h3>
          <div className="ride-card">
            <div className="ride-card-top">
              <span className={`badge badge--${activeRide.status}`}>{activeRide.status}</span>
            </div>
            <div className="ride-card-details">
              <div className="ride-detail">
                <span className="ride-detail-label">Passenger</span>
                <span className="ride-detail-value">{activePassenger?.name || 'Unknown'}</span>
              </div>
              <div className="ride-detail">
                <span className="ride-detail-label">Pickup</span>
                <span className="ride-detail-value">{activeRide.pickupLat?.toFixed(4)}, {activeRide.pickupLng?.toFixed(4)}</span>
              </div>
              <div className="ride-detail">
                <span className="ride-detail-label">Drop-off</span>
                <span className="ride-detail-value">{activeRide.dropoffLat?.toFixed(4)}, {activeRide.dropoffLng?.toFixed(4)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              {activeRide.status === 'accepted' && (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleStatus(activeRide.id, 'arrived')}>
                  Mark Arrived
                </button>
              )}
              {activeRide.status === 'arrived' && (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleStatus(activeRide.id, 'in_progress')}>
                  Start Ride
                </button>
              )}
              {activeRide.status === 'in_progress' && (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleStatus(activeRide.id, 'completed')}>
                  Complete Ride
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="section">
        <h3 className="section-title">Pending Requests ({pendingRides.length})</h3>

        {pendingRides.length === 0 ? (
          <div className="empty-section" style={{ marginTop: 0 }}>
            <div className="empty-icon">🚗</div>
            <h3>No ride requests</h3>
            <p>Waiting for passengers to request rides.</p>
          </div>
        ) : (
          <div className="ride-list">
            {pendingRides.map((ride) => (
              <div key={ride.id} className="ride-card">
                <div className="ride-card-details">
                  <div className="ride-detail">
                    <span className="ride-detail-label">Passenger</span>
                    <span className="ride-detail-value">{ride.passenger?.name || 'Unknown'}</span>
                  </div>
                  <div className="ride-detail">
                    <span className="ride-detail-label">Pickup</span>
                    <span className="ride-detail-value">{ride.pickupLat?.toFixed(4)}, {ride.pickupLng?.toFixed(4)}</span>
                  </div>
                  <div className="ride-detail">
                    <span className="ride-detail-label">Drop-off</span>
                    <span className="ride-detail-value">{ride.dropoffLat?.toFixed(4)}, {ride.dropoffLng?.toFixed(4)}</span>
                  </div>
                  <div className="ride-detail">
                    <span className="ride-detail-label">Distance</span>
                    <span className="ride-detail-value">{ride.distance ? `${ride.distance.toFixed(1)} km` : 'N/A'}</span>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => handleAccept(ride.id)}>
                  Accept Ride
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverRides;
