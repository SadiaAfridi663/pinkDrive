import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { rideAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import logger from '../utils/logger';

function PassengerBidding() {
  const { id } = useParams();
  const { socket } = useSocket();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(null);
  const [loadingRide, setLoadingRide] = useState(true);

  useEffect(() => {
    if (!id) return;
    rideAPI.getRideById(id).then((res) => {
      const r = res.data.data.ride;
      setRide(r);
      if (r.status !== 'pending') {
        navigate('/ride/active', { replace: true });
      }
    }).catch(() => setError('Failed to load ride.')).finally(() => setLoadingRide(false));

    rideAPI.getRideBids(id).then((res) => {
      const rawBids = res.data.data.bids || [];
      logger.info(`[Bidding] REST bids response: ${rawBids.length} bids for ride ${id}, status ${res.status}`);
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
    }).catch((err) => {
      logger.error(`[Bidding] REST bids fetch failed: ${err.message}`);
    });
  }, [id]);

  // Re-fetch when returning to tab (in case ride was accepted in another tab)
  useEffect(() => {
    if (!id) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        rideAPI.getRideById(id).then((res) => {
          const r = res.data.data.ride;
          setRide(r);
          if (r.status !== 'pending') {
            navigate('/ride/active', { replace: true });
          }
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [id]);

  useEffect(() => {
    if (!socket || !id) {
      logger.warn(`[Bidding] socket not ready yet (socket=${!!socket}, id=${!!id})`);
      return;
    }
    logger.info(`[Bidding] Setting up socket listeners, joining room ride:${id}, socket connected=${socket.connected}`);
    const joinRoom = () => {
      logger.info(`[Bidding] Emitting join:ride for ${id}`);
      socket.emit('join:ride', id);
    };
    joinRoom();

    const handleReconnect = () => {
      logger.info(`[Bidding] Socket reconnected, re-joining room ride:${id}`);
      joinRoom();
    };
    socket.on('connect', handleReconnect);

    const handleNewOffer = (data) => {
      logger.info(`[Bidding] received new:offer for ride ${data.rideId}, bidId ${data.bidId}, amount ${data.amount}`);
      if (String(data.rideId) !== String(id)) {
        logger.warn(`[Bidding] rideId mismatch: data.rideId=${data.rideId} (${typeof data.rideId}) !== id=${id} (${typeof id})`);
        return;
      }
      setOffers((prev) => {
        if (prev.find((o) => o.bidId === data.bidId)) return prev;
        logger.info(`[Bidding] adding offer to state: bidId ${data.bidId}, amount ${data.amount}`);
        return [...prev, { ...data, expiresAt: new Date(data.expiresAt).getTime() }];
      });
    };

    const handleOfferExpired = (data) => {
      logger.info(`[Bidding] received offer:expired for ride ${data.rideId}, bidId ${data.bidId}`);
      if (String(data.rideId) !== String(id)) return;
      setOffers((prev) => prev.filter((o) => o.bidId !== data.bidId));
    };

    const handleOfferAccepted = (data) => {
      logger.info(`[Bidding] received offer:accepted for ride ${data.rideId}`);
      if (String(data.rideId) !== String(id)) return;
      setOffers([]);
      navigate(`/ride/active`);
    };

    const handleAcceptRedirect = (data) => {
      handleAccept(data.bidId);
    };

    socket.on('new:offer', handleNewOffer);
    socket.on('offer:expired', handleOfferExpired);
    socket.on('offer:accepted', handleOfferAccepted);
    socket.on('accept:redirect', handleAcceptRedirect);

    return () => {
      socket.emit('leave:ride', id);
      socket.off('connect', handleReconnect);
      socket.off('new:offer', handleNewOffer);
      socket.off('offer:expired', handleOfferExpired);
      socket.off('offer:accepted', handleOfferAccepted);
      socket.off('accept:redirect', handleAcceptRedirect);
    };
  }, [socket, id]);

  const handleAccept = async (bidId) => {
    setAccepting(bidId);
    try {
      await rideAPI.acceptOffer(bidId);
      navigate('/ride/active');
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

  // Remove expired offers from local state
  useEffect(() => {
    setOffers((prev) => prev.filter((o) => o.expiresAt > now));
  }, [now]);

  if (loadingRide) return <div className="page"><div className="loading-skeleton h-8 w-1/3" /><div className="loading-skeleton h-4 w-2/3 mt-3" /></div>;

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Waiting for Offers</h1>
        <p>Your offer: <strong>{ride?.passengerOffer} PKR</strong> &middot; Drivers are bidding nearby</p>
      </div>

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
            const pct = Math.max(0, (timeLeft / 30) * 100);
            return (
              <div key={offer.bidId} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {offer.driverName?.[0]?.toUpperCase() || 'D'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy m-0 truncate">{offer.driverName || 'Driver'}</p>
                    <p className="text-xs text-stone m-0">Offering</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-navy m-0">{offer.amount} PKR</p>
                </div>

                {/* Countdown bar: dark pink → light pink */}
                <div className="h-2 rounded-full bg-pink-light/50 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-pink transition-[width] linear"
                    style={{ width: `${pct}%`, transitionDuration: '200ms' }}
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

      <div className="mt-6 card p-4">
        <p className="text-xs text-stone m-0">
          <strong>Pickup:</strong> {ride?.pickupAddress || `${ride?.pickupLat?.toFixed(4)}, ${ride?.pickupLng?.toFixed(4)}`}
        </p>
        <p className="text-xs text-stone m-0 mt-1">
          <strong>Drop-off:</strong> {ride?.dropoffAddress || `${ride?.dropoffLat?.toFixed(4)}, ${ride?.dropoffLng?.toFixed(4)}`}
        </p>
        {ride?.distance && <p className="text-xs text-stone m-0 mt-1"><strong>Distance:</strong> {ride.distance} km</p>}
      </div>
    </div>
  );
}

export default PassengerBidding;
