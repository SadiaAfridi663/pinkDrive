import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

function ActiveRide() {
  const [ride, setRide] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const fetchRide = async () => {
    try {
      const res = await rideAPI.getActiveRide();
      const data = res.data.data;
      if (!data.ride) {
        setRide(null);
        return;
      }
      setRide(data.ride);
      setDriver(data.driver);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load ride.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRide();
    const interval = setInterval(fetchRide, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async () => {
    if (!ride) return;
    try {
      await rideAPI.cancelRide(ride.id);
      navigate('/passenger');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel.');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!ride) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Active Ride</h1>
        </div>
        <div className="empty-section">
          <div className="empty-icon">🚗</div>
          <h3>No active ride</h3>
          <p>You don't have an active ride right now.</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/ride/request')}>
            Request a Ride
          </button>
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
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Your Ride</h1>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="ride-card">
        <div className="ride-card-top">
          <span className={`badge badge--${ride.status}`}>{ride.status}</span>
        </div>

        <p className="ride-card-status">{statusDisplay[ride.status]}</p>

        <div className="ride-card-details">
          <div className="ride-detail">
            <span className="ride-detail-label">Pickup</span>
            <span className="ride-detail-value">{ride.pickupLat?.toFixed(4)}, {ride.pickupLng?.toFixed(4)}</span>
          </div>
          <div className="ride-detail">
            <span className="ride-detail-label">Drop-off</span>
            <span className="ride-detail-value">{ride.dropoffLat?.toFixed(4)}, {ride.dropoffLng?.toFixed(4)}</span>
          </div>
          {driver && (
            <div className="ride-detail">
              <span className="ride-detail-label">Driver</span>
              <span className="ride-detail-value">{driver.name} {driver.phone ? `(${driver.phone})` : ''}</span>
            </div>
          )}
        </div>

        {ride.status === 'pending' && (
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleCancel}>
            Cancel Ride
          </button>
        )}

        {ride.status === 'completed' && (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/passenger')}>
            Back to Home
          </button>
        )}
      </div>
    </div>
  );
}

export default ActiveRide;
