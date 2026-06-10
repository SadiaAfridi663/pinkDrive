import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import RideRouteMap from '../components/RideRouteMap';
import Avatar from '../components/Avatar';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function AdminRideDetail() {
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
        const res = await adminAPI.getRideById(id);
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
        <button className="btn btn-secondary" onClick={() => navigate('/admin/rides')}>Back to Rides</button>
      </div>
    );
  }

  const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
  const dropoff = { lat: ride.dropoffLat, lng: ride.dropoffLng };

  const getFileUrl = (fp) => {
    if (!fp) return null;
    const n = fp.replace(/\\/g, '/');
    if (n.startsWith('http://') || n.startsWith('https://')) return n;
    return `${API_URL}/${n}`;
  };

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
            <Avatar name={driver.name} size="lg" src={getFileUrl(driver.profilePhoto)} />
            <div>
              <p className="m-0 font-semibold text-navy text-xs opacity-60">Driver</p>
              <p className="m-0 font-semibold text-navy text-base">{driver.name}</p>
              {driver.email && <p className="m-0 mt-0.5 text-stone text-sm">{driver.email}</p>}
              {driver.phone && <p className="m-0 text-stone text-sm">{driver.phone}</p>}
            </div>
          </div>
        )}

        {passenger && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-ivory rounded-sm">
            <Avatar name={passenger.name} size="lg" />
            <div>
              <p className="m-0 font-semibold text-navy text-xs opacity-60">Passenger</p>
              <p className="m-0 font-semibold text-navy text-base">{passenger.name}</p>
              {passenger.email && <p className="m-0 mt-0.5 text-stone text-sm">{passenger.email}</p>}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Pickup</span>
            <span className="font-medium text-navy font-mono">{ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Drop-off</span>
            <span className="font-medium text-navy font-mono">{ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}</span>
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
              <span className="font-medium text-navy font-mono font-bold">{ride.fare} PKR</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Payment Method</span>
            <span className="font-medium text-navy font-mono capitalize">{ride.paymentMethod || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-stone">Payment Status</span>
            <span className="font-medium text-navy font-mono capitalize">{ride.paymentStatus || 'N/A'}</span>
          </div>
          {ride.startedAt && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-stone">Started</span>
              <span className="font-medium text-navy font-mono">{new Date(ride.startedAt).toLocaleString()}</span>
            </div>
          )}
          {ride.completedAt && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-stone">Completed</span>
              <span className="font-medium text-navy font-mono">{new Date(ride.completedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        <button className="btn btn-secondary w-full mt-3" onClick={() => navigate('/admin/rides')}>
          Back to Rides
        </button>
      </div>
    </div>
  );
}

export default AdminRideDetail;
