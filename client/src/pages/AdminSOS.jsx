import { useState, useEffect, useCallback, useRef } from 'react';
import { sosAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';

function AdminSOS() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('active');
  const resolvingRef = useRef(null);
  const { socket } = useSocket();

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await sosAPI.getAlerts(filter);
      setAlerts(res.data.data.alerts);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (!socket) return;
    const onAlert = () => { fetchAlerts(); };
    const onResolved = () => { fetchAlerts(); };
    socket.on('sos:alert', onAlert);
    socket.on('sos:resolved', onResolved);
    return () => {
      socket.off('sos:alert', onAlert);
      socket.off('sos:resolved', onResolved);
    };
  }, [socket, fetchAlerts]);

  const handleResolve = async (id) => {
    resolvingRef.current = id;
    setError('');
    setMessage('');
    try {
      const res = await sosAPI.resolveAlert(id);
      setMessage(res.data.message);
      fetchAlerts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve.');
    } finally {
      resolvingRef.current = null;
    }
  };

  const badgeClass = (status) => {
    const base = 'inline-block text-xs font-semibold uppercase tracking-[0.05em] px-2 py-1 rounded';
    return status === 'active'
      ? `${base} bg-[#ffebee] text-error`
      : `${base} bg-[#e8f5e9] text-success`;
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-stone-light text-sm">Loading...</div>;

  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-[2.2rem] font-bold text-navy tracking-[-0.02em] leading-[1.15] m-0">SOS Alerts</h1>
          <p className="text-[0.95rem] text-stone mt-1 m-0">Monitor and respond to emergency alerts</p>
        </div>
        <div className="flex gap-1">
          <button
            className={`px-3 py-1.5 text-xs font-semibold border rounded-sm cursor-pointer transition ${filter === 'active' ? 'bg-error text-white border-error' : 'bg-white text-stone border-border hover:border-error hover:text-error'}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-semibold border rounded-sm cursor-pointer transition ${filter === 'resolved' ? 'bg-success text-white border-success' : 'bg-white text-stone border-border hover:border-success hover:text-success'}`}
            onClick={() => setFilter('resolved')}
          >
            Resolved
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-semibold border rounded-sm cursor-pointer transition ${!filter ? 'bg-navy text-white border-navy' : 'bg-white text-stone border-border'}`}
            onClick={() => setFilter('')}
          >
            All
          </button>
        </div>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {message && <p className="msg msg-success">{message}</p>}

      {alerts.length === 0 ? (
        <div className="text-center p-12">
          <div className="text-4xl mb-2">&#10004;&#65039;</div>
          <h3 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-1">All clear</h3>
          <p className="text-sm text-stone m-0">No {filter || ''} SOS alerts.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`card p-4 ${alert.status === 'active' ? 'border-error border-2' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {alert.status === 'active' && <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />}
                  <span className="font-semibold text-navy text-[0.95rem]">{alert.user?.name || 'Unknown'}</span>
                  <span className={badgeClass(alert.status)}>{alert.status}</span>
                </div>
                <span className="text-xs text-stone-light">{new Date(alert.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-stone my-0.5">{alert.user?.email}{alert.user?.phone ? ` ┬╖ ${alert.user.phone}` : ''}</p>

              {alert.pickupAddress && (
                <p className="text-xs text-stone my-0.5">
                  Pickup: {alert.pickupAddress}
                </p>
              )}
              {alert.dropoffAddress && (
                <p className="text-xs text-stone my-0.5">
                  Drop-off: {alert.dropoffAddress}
                </p>
              )}

              {alert.rideId && (
                <p className="text-xs text-stone my-0.5">Ride ID: {alert.rideId}</p>
              )}

              {alert.lat && alert.lng && (
                <p className="text-xs text-stone my-0.5 font-mono">
                  Location: {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${alert.lat}&mlon=${alert.lng}&zoom=15`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-coral no-underline hover:underline"
                  >
                    View on map &rarr;
                  </a>
                </p>
              )}

              {alert.contacts?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-stone mb-1">Emergency Contacts:</p>
                  {alert.contacts.map((c, i) => (
                    <p key={i} className="text-xs text-stone my-0.5">
                      {c.name} ┬╖ {c.phone}{c.relationship ? ` ┬╖ ${c.relationship}` : ''}
                    </p>
                  ))}
                </div>
              )}

              {alert.status === 'active' && (
                <button
                  className="btn btn-success mt-3"
                  disabled={resolvingRef.current === alert.id}
                  onClick={() => handleResolve(alert.id)}
                >
                  {resolvingRef.current === alert.id ? 'Resolving...' : 'Mark Resolved'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminSOS;
