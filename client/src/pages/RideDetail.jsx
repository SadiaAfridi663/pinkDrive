import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AddressLabel from '../components/AddressLabel';
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
      cancelled: 'bg-[#f5f5f5] text-stone-light',
    };
    return `${base} ${colors[status] || colors.pending}`;
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-stone-light text-sm">Loading...</div>;

  if (error || !ride) {
    return (
      <div className="page">
        <div className="page-header page-header-accent">
          <h1>Ride Details</h1>
        </div>
        <p className="msg msg-error">{error || 'Ride not found.'}</p>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
  const dropoff = { lat: ride.dropoffLat, lng: ride.dropoffLng };

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Ride Details</h1>
      </div>

      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className={badgeClass(ride.status)}>{ride.status}</span>
          <span className="text-xs text-stone">
            {new Date(ride.createdAt).toLocaleString()}
          </span>
        </div>

        <div className="mb-4 rounded-sm overflow-hidden border-2 border-border">
            <RideRouteMap pickup={pickup} dropoff={dropoff} height="220px" />
          </div>

        {driver && (
          <div className="flex items-center gap-4 mb-3 p-3 bg-ivory rounded-sm">
            {driver.profilePhoto ? (
              <img
                src={`${API_URL}/${driver.profilePhoto.replace(/\\/g, '/')}`}
                alt={driver.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-border"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-coral-light flex items-center justify-center text-lg text-coral">
                {driver.name?.[0] || 'D'}
              </div>
            )}
            <div>
              <p className="m-0 font-semibold text-navy text-xs opacity-60">Driver</p>
              <p className="m-0 font-semibold text-navy text-base">{driver.name}</p>
              {driver.phone && <p className="m-0 mt-0.5 text-stone text-sm">{driver.phone}</p>}
            </div>
          </div>
        )}

        {passenger && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-ivory rounded-sm">
            {passenger.selfiePath ? (
              <img
                src={`${API_URL}/${passenger.selfiePath.replace(/\\/g, '/')}`}
                alt={passenger.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-border"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-coral-light flex items-center justify-center text-lg text-coral">
                {passenger.name?.[0] || 'P'}
              </div>
            )}
            <div>
              <p className="m-0 font-semibold text-navy text-xs opacity-60">Passenger</p>
              <p className="m-0 font-semibold text-navy text-base">{passenger.name}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Pickup</span>
            <span className="font-medium text-navy font-mono"><AddressLabel address={ride.pickupAddress} lat={ride.pickupLat} lng={ride.pickupLng} /></span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Drop-off</span>
            <span className="font-medium text-navy font-mono"><AddressLabel address={ride.dropoffAddress} lat={ride.dropoffLat} lng={ride.dropoffLng} /></span>
          </div>
          {ride.distance && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-stone">Distance</span>
              <span className="font-medium text-navy font-mono">{ride.distance} km</span>
            </div>
          )}
          {ride.fare > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-stone">Fare</span>
              <span className="font-medium text-navy font-mono font-bold text-navy">{ride.fare} PKR</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Payment</span>
            <span className="font-medium text-navy font-mono capitalize">
              {ride.paymentMethod || 'N/A'}
              {ride.paymentMethod === 'cash' && ride.status === 'completed' ? ' (due)' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Payment Status</span>
            <span className="font-medium text-navy font-mono capitalize">{ride.paymentStatus || 'N/A'}</span>
          </div>
          {ride.completedAt && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-stone">Completed</span>
              <span className="font-medium text-navy font-mono">{new Date(ride.completedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        <button className="btn btn-secondary w-full mt-3" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    </div>
  );
}

export default RideDetail;
