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

  if (error || !ride) {
    return (
      <div className="max-w-page mx-auto px-6 py-8 pb-16">
        <div className="mb-8">
          <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Ride Details</h1>
        </div>
        <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{error || 'Ride not found.'}</p>
        <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
  const dropoff = { lat: ride.dropoffLat, lng: ride.dropoffLng };

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Ride Details</h1>
      </div>

      <div className="bg-white border border-border rounded p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className={badgeClass(ride.status)}>{ride.status}</span>
          <span className="text-xs text-text-muted">
            {new Date(ride.createdAt).toLocaleString()}
          </span>
        </div>

        {ride.status === 'completed' && (
          <div className="mb-4 rounded-sm overflow-hidden border-2 border-border">
            <RideRouteMap pickup={pickup} dropoff={dropoff} height="220px" />
          </div>
        )}

        {driver && (
          <div className="flex items-center gap-4 mb-3 p-3 bg-off-white rounded-sm">
            {driver.profilePhoto ? (
              <img
                src={`${API_URL}/${driver.profilePhoto.replace(/\\/g, '/')}`}
                alt={driver.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-border"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-pink-subtle flex items-center justify-center text-lg text-pink">
                {driver.name?.[0] || 'D'}
              </div>
            )}
            <div>
              <p className="m-0 font-semibold text-plum text-xs opacity-60">Driver</p>
              <p className="m-0 font-semibold text-plum text-base">{driver.name}</p>
              {driver.phone && <p className="m-0 mt-0.5 text-text-muted text-sm">{driver.phone}</p>}
            </div>
          </div>
        )}

        {passenger && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-off-white rounded-sm">
            {passenger.selfiePath ? (
              <img
                src={`${API_URL}/${passenger.selfiePath.replace(/\\/g, '/')}`}
                alt={passenger.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-border"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-pink-subtle flex items-center justify-center text-lg text-pink">
                {passenger.name?.[0] || 'P'}
              </div>
            )}
            <div>
              <p className="m-0 font-semibold text-plum text-xs opacity-60">Passenger</p>
              <p className="m-0 font-semibold text-plum text-base">{passenger.name}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Pickup</span>
            <span className="font-medium text-plum font-mono">{ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Drop-off</span>
            <span className="font-medium text-plum font-mono">{ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}</span>
          </div>
          {ride.distance && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Distance</span>
              <span className="font-medium text-plum font-mono">{ride.distance} km</span>
            </div>
          )}
          {ride.fare > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Fare</span>
              <span className="font-medium text-plum font-mono font-bold text-plum">{ride.fare} PKR</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Payment</span>
            <span className="font-medium text-plum font-mono capitalize">
              {ride.paymentMethod || 'N/A'}
              {ride.paymentMethod === 'cash' && ride.status === 'completed' ? ' (due)' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-muted">Payment Status</span>
            <span className="font-medium text-plum font-mono capitalize">{ride.paymentStatus || 'N/A'}</span>
          </div>
          {ride.completedAt && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Completed</span>
              <span className="font-medium text-plum font-mono">{new Date(ride.completedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition w-full mt-3" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    </div>
  );
}

export default RideDetail;
