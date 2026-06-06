import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import RideRouteMap from '../components/RideRouteMap';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function RideDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [driver, setDriver] = useState(null);
  const [passenger, setPassenger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await rideAPI.getRideById(id);
        setRide(res.data.data.ride);
        setDriver(res.data.data.driver);
        setPassenger(res.data.data.passenger);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load ride details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;

  if (error || !ride) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Ride Details</h1>
        </div>
        <p className="auth-error">{error || 'Ride not found.'}</p>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
  const dropoff = { lat: ride.dropoffLat, lng: ride.dropoffLng };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Ride Details</h1>
      </div>

      <div className="ride-card">
        <div className="ride-card-top">
          <span className={`badge badge--${ride.status}`}>{ride.status}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {new Date(ride.createdAt).toLocaleString()}
          </span>
        </div>

        {ride.status === 'completed' && (
          <div style={{ marginBottom: '1rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
            <RideRouteMap pickup={pickup} dropoff={dropoff} height="220px" />
          </div>
        )}

        {driver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--off-white)', borderRadius: 'var(--radius-sm)' }}>
            {driver.profilePhoto ? (
              <img
                src={`${API_URL}/${driver.profilePhoto.replace(/\\/g, '/')}`}
                alt={driver.name}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--pink-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: 'var(--pink)' }}>
                {driver.name?.[0] || 'D'}
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--plum)', fontSize: '0.85rem', opacity: 0.6 }}>Driver</p>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--plum)', fontSize: '1rem' }}>{driver.name}</p>
              {driver.phone && <p style={{ margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{driver.phone}</p>}
            </div>
          </div>
        )}

        {passenger && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--off-white)', borderRadius: 'var(--radius-sm)' }}>
            {passenger.selfiePath ? (
              <img
                src={`${API_URL}/${passenger.selfiePath.replace(/\\/g, '/')}`}
                alt={passenger.name}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--pink-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: 'var(--pink)' }}>
                {passenger.name?.[0] || 'P'}
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--plum)', fontSize: '0.85rem', opacity: 0.6 }}>Passenger</p>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--plum)', fontSize: '1rem' }}>{passenger.name}</p>
            </div>
          </div>
        )}

        <div className="ride-card-details">
          <div className="ride-detail">
            <span className="ride-detail-label">Pickup</span>
            <span className="ride-detail-value">{ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}</span>
          </div>
          <div className="ride-detail">
            <span className="ride-detail-label">Drop-off</span>
            <span className="ride-detail-value">{ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}</span>
          </div>
          {ride.distance && (
            <div className="ride-detail">
              <span className="ride-detail-label">Distance</span>
              <span className="ride-detail-value">{ride.distance} km</span>
            </div>
          )}
          {ride.fare > 0 && (
            <div className="ride-detail">
              <span className="ride-detail-label">Fare</span>
              <span className="ride-detail-value" style={{ fontWeight: 700, color: 'var(--plum)' }}>{ride.fare} PKR</span>
            </div>
          )}
          <div className="ride-detail">
            <span className="ride-detail-label">Payment</span>
            <span className="ride-detail-value" style={{ textTransform: 'capitalize' }}>
              {ride.paymentMethod || 'N/A'}
              {ride.paymentMethod === 'cash' && ride.status === 'completed' ? ' (due)' : ''}
            </span>
          </div>
          <div className="ride-detail">
            <span className="ride-detail-label">Payment Status</span>
            <span className="ride-detail-value" style={{ textTransform: 'capitalize' }}>{ride.paymentStatus || 'N/A'}</span>
          </div>
          {ride.completedAt && (
            <div className="ride-detail">
              <span className="ride-detail-label">Completed</span>
              <span className="ride-detail-value">{new Date(ride.completedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        <button className="btn btn-outline" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    </div>
  );
}

export default RideDetail;
