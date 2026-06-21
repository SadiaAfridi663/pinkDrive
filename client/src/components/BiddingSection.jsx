import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { rideAPI } from '../services/api';
import logger from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function BiddingSection({ rideId, onAccepted }) {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(null);
  const [loadingRide, setLoadingRide] = useState(true);

  useEffect(() => {
    if (!rideId) return;
    rideAPI.getRideById(rideId).then((res) => {
      const r = res.data.data.ride;
      setRide(r);
    }).catch(() => setError('Failed to load ride.')).finally(() => setLoadingRide(false));

    rideAPI.getRideBids(rideId).then((res) => {
      const rawBids = res.data.data.bids || [];
      const bids = rawBids.map((b) => ({
        ...b,
        expiresAt: new Date(b.expiresAt).getTime(),
      }));
      setOffers((prev) => {
        const existingIds = new Set(prev.map((o) => o.bidId));
        const newBids = bids.filter((b) => !existingIds.has(b.bidId));
        if (newBids.length > 0) logger.info(`[Bidding] Adding ${newBids.length} bid(s) from REST`);
        return [...prev, ...newBids];
      });
    }).catch(() => {});
  }, [rideId]);

  useEffect(() => {
    if (!socket || !rideId) return;
    const joinRoom = () => { socket.emit('join:ride', rideId); };
    joinRoom();

    socket.on('connect', joinRoom);

    const handleNewOffer = (data) => {
      if (String(data.rideId) !== String(rideId)) return;
      setOffers((prev) => {
        if (prev.find((o) => o.bidId === data.bidId)) return prev;
        return [...prev, { ...data, expiresAt: new Date(data.expiresAt).getTime() }];
      });
    };

    const handleOfferExpired = (data) => {
      if (String(data.rideId) !== String(rideId)) return;
      setOffers((prev) => prev.filter((o) => o.bidId !== data.bidId));
    };

    const handleOfferAccepted = (data) => {
      if (String(data.rideId) !== String(rideId)) return;
      setOffers([]);
      if (onAccepted) onAccepted();
      else navigate('/ride/active');
    };

    socket.on('new:offer', handleNewOffer);
    socket.on('offer:expired', handleOfferExpired);
    socket.on('offer:accepted', handleOfferAccepted);

    return () => {
      socket.emit('leave:ride', rideId);
      socket.off('connect', joinRoom);
      socket.off('new:offer', handleNewOffer);
      socket.off('offer:expired', handleOfferExpired);
      socket.off('offer:accepted', handleOfferAccepted);
    };
  }, [socket, rideId]);

  const handleAccept = async (bidId) => {
    setAccepting(bidId);
    try {
      await rideAPI.acceptOffer(bidId);
      if (onAccepted) onAccepted();
      else navigate('/ride/active');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept offer.');
      setAccepting(null);
    }
  };

  const getTimeLeft = (expiresAt) => {
    const diff = expiresAt - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  };

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setOffers((prev) => prev.filter((o) => o.expiresAt > now));
  }, [now]);

  if (loadingRide) return <div className="loading-skeleton h-8 w-1/3" />;

  return (
    <div>
      {error && <p className="msg msg-error">{error}</p>}

      {offers.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3 text-stone/30">...</div>
          <p className="text-sm text-stone m-0">No offers yet. Waiting for drivers nearby...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {offers.map((offer) => {
            const timeLeft = getTimeLeft(offer.expiresAt);
            const pct = Math.max(0, (timeLeft / 10) * 100);
            return (
              <div key={offer.bidId} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  {offer.driverPhoto ? (
                    <img src={`${API_URL}/${offer.driverPhoto.replace(/\\/g, '/')}`} alt={offer.driverName} className="w-10 h-10 rounded-full object-cover border-2 border-border shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {offer.driverName?.[0]?.toUpperCase() || 'D'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy m-0 truncate">{offer.driverName || 'Driver'}</p>
                    <p className="text-xs text-stone m-0">Offering</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-navy m-0">{offer.amount} PKR</p>
                </div>

                <div className="h-2 rounded-full bg-pink-light/50 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-pink transition-all duration-300 ease-in-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone font-mono">{timeLeft}s remaining</span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleAccept(offer.bidId)}
                    disabled={accepting === offer.bidId}
                  >
                    {accepting === offer.bidId ? 'Accepting...' : 'Accept Offer'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ride && (
        <div className="mt-6 card p-4">
          <p className="text-xs text-stone m-0">
            <strong>Pickup:</strong> {ride.pickupAddress || `${ride.pickupLat?.toFixed(4)}, ${ride.pickupLng?.toFixed(4)}`}
          </p>
          <p className="text-xs text-stone m-0 mt-1">
            <strong>Drop-off:</strong> {ride.dropoffAddress || `${ride.dropoffLat?.toFixed(4)}, ${ride.dropoffLng?.toFixed(4)}`}
          </p>
          {ride.distance && <p className="text-xs text-stone m-0 mt-1"><strong>Distance:</strong> {ride.distance} km</p>}
        </div>
      )}
    </div>
  );
}

export default BiddingSection;