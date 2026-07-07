import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { rideAPI, serviceAreaAPI, paymentsAPI, walletAPI, sharedTripAPI } from '../services/api';
import MapLocationPicker from '../components/MapLocationPicker';
import RideRouteMap from '../components/RideRouteMap';
import AddressLabel from '../components/AddressLabel';
import SelfieCapture from '../components/SelfieCapture';
import LocationGate from '../components/LocationGate';
import useGeolocation from '../hooks/useGeolocation';
import { reverseGeocode } from '../utils/geocode';

const FARE_PER_KM = 50;

function RequestRideInner() {
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('tripId');
  const isShared = !!tripId;

  const [pickup, setPickup] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoff, setDropoff] = useState(null);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [step, setStep] = useState('pickup');
  const [selfieDataUrl, setSelfieDataUrl] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [stripeConfigured, setStripeConfigured] = useState(true);
  const [walletBalance, setWalletBalance] = useState(null);
  const [passengerOffer, setPassengerOffer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharedTrips, setSharedTrips] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [activeBlock, setActiveBlock] = useState(null);
  const [activeRequestId, setActiveRequestId] = useState(null);
  const navigate = useNavigate();
  const { position } = useGeolocation();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const [activeRes, reqsRes] = await Promise.allSettled([
          rideAPI.getActiveRide(),
          sharedTripAPI.getMyRequests(),
        ]);
        if (cancelled) return;
        if (activeRes.status === 'fulfilled' && activeRes.value.data.data?.ride) {
          setActiveBlock('private');
          return;
        }
        if (reqsRes.status === 'fulfilled') {
          const reqs = reqsRes.value.data.data?.requests || [];
          const accepted = reqs.find(r => r.status === 'accepted');
          if (accepted) {
            setActiveBlock('shared');
            setActiveRequestId(accepted.id);
            return;
          }
        }
        setActiveBlock(false);
      } catch {
        if (!cancelled) setActiveBlock(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!tripId) return;
    const fetchTrip = async () => {
      try {
        const res = await sharedTripAPI.getMyTrips();
        const trip = res.data.data.trips.find(t => t.id === tripId);
        if (trip) setSelectedTrip(trip);
      } catch { /* ignore */ }
    };
    fetchTrip();
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await serviceAreaAPI.getActive();
        if (!cancelled) setServiceAreas(res.data.data.areas);
      } catch { /* ignore */ }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await paymentsAPI.getConfig();
        if (!cancelled) setStripeConfigured(res.data.data.stripeConfigured);
      } catch { /* ignore */ }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await walletAPI.getWallet();
        if (!cancelled) setWalletBalance(parseFloat(res.data.data.wallet.balance));
      } catch { /* ignore */ }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  const distance =
    pickup && dropoff
      ? Math.round(haversine(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) * 100) / 100
      : null;

  const fare = distance ? Math.round(distance * FARE_PER_KM * 100) / 100 : null;

  useEffect(() => {
    if (!pickup) return;
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await rideAPI.getNearbyDrivers(pickup.lat, pickup.lng, 10);
        if (!cancelled) setNearbyDrivers(res.data.data.drivers);
      } catch { /* ignore */ }
    };
    fetch();
    return () => { cancelled = true; };
  }, [pickup]);

  useEffect(() => {
    if (!pickup || !dropoff) { setSharedTrips([]); return; }
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await sharedTripAPI.getAvailable(pickup.lat, pickup.lng);
        if (!cancelled) {
          const trips = (res.data.data.trips || []).map(t => ({
            ...t,
            tripId: t.tripId || t.id
          }));
          setSharedTrips(trips);
        }
      } catch {
        if (!cancelled) setSharedTrips([]);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [pickup, dropoff]);

  const handleRequestJoin = async (tripId) => {
    if (!pickup || !dropoff) return;
    setLoading(true);
    try {
      await sharedTripAPI.requestJoin(tripId, {
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
      });
      navigate('/passenger');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join shared trip.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelfieCapture = useCallback((dataUrl) => setSelfieDataUrl(dataUrl), []);

  const handleSubmit = async () => {
    if (!pickup || !dropoff) {
      setError('Please select both pickup and drop-off locations.');
      return;
    }
    if (!selfieDataUrl) {
      setError('Please capture a selfie before requesting a ride.');
      return;
    }
    if (!passengerOffer || parseFloat(passengerOffer) <= 0) {
      setError('Please enter your offer amount.');
      return;
    }
    if (paymentMethod === 'wallet' && walletBalance !== null && parseFloat(passengerOffer) > walletBalance) {
      setError(`Your offer (${parseFloat(passengerOffer).toFixed(0)} PKR) exceeds your wallet balance (${walletBalance.toFixed(0)} PKR). Please lower your offer or top up your wallet.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const blob = await (await fetch(selfieDataUrl)).blob();
      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');
      const selfieRes = await rideAPI.uploadTempSelfie(formData);
      const rideRes = await rideAPI.createRide({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: pickupAddress || `${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}`,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffAddress: dropoffAddress || `${dropoff.lat.toFixed(4)}, ${dropoff.lng.toFixed(4)}`,
        selfiePath: selfieRes.data.data.selfiePath,
        paymentMethod,
        passengerOffer: parseFloat(passengerOffer),
      });

      navigate(`/ride/bidding/${rideRes.data.data.ride.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create ride.');
    } finally {
      setLoading(false);
    }
  };

  const stepClass = (name) => {
    const base = 'px-3 py-1 rounded-full font-medium text-xs';
    if (step === name) return `${base} bg-pink text-white`;
    if (name === 'pickup' && pickup) return `${base} bg-[#e8f5e9] text-success`;
    if (name === 'dropoff' && dropoff) return `${base} bg-[#e8f5e9] text-success`;
    if (name === 'selfie' && selfieDataUrl) return `${base} bg-[#e8f5e9] text-success`;
    return `${base} bg-[#f5f5f5] text-text-light`;
  };

  if (activeBlock === 'private') {
    return (
      <div className="max-w-2xl w-full px-6 py-8 pb-16 text-center">
        <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 shadow-sm">
          <div className="mx-auto mb-5 w-20 h-20 bg-[#FCE4EC] rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-[#E91E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 17h14M5 12h14M5 7h14" /></svg>
          </div>
          <h2 className="text-xl font-bold text-[#880E4F] m-0 mb-2">You Already Have an Active Ride</h2>
          <p className="text-sm text-[#8B8B9E] m-0 mb-6 max-w-sm mx-auto">You cannot request a new ride while you already have one in progress. Please complete or cancel your current ride first.</p>
          <button className="bg-[#E91E8C] text-white font-bold text-sm py-3 px-8 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none" onClick={() => navigate('/ride/active')}>
            View Active Ride
          </button>
        </div>
      </div>
    );
  }

  if (activeBlock === 'shared') {
    return (
      <div className="max-w-2xl w-full px-6 py-8 pb-16 text-center">
        <div className="bg-white rounded-2xl border border-[#F0E0E8] p-10 shadow-sm">
          <div className="mx-auto mb-5 w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 14l2-5h14l2 5" /><path d="M5 14v3a1 1 0 001 1h2a1 1 0 001-1v-1" /><path d="M15 17a1 1 0 001 1h2a1 1 0 001-1v-1" /></svg>
          </div>
          <h2 className="text-xl font-bold text-[#880E4F] m-0 mb-2">You Have an Active Shared Trip</h2>
          <p className="text-sm text-[#8B8B9E] m-0 mb-6 max-w-sm mx-auto">You already have an accepted shared trip. Please complete or cancel it before booking a new ride.</p>
          <button className="bg-amber-500 text-white font-bold text-sm py-3 px-8 rounded-xl hover:bg-amber-600 transition cursor-pointer border-none" onClick={() => navigate(`/shared-trip/${activeRequestId}`)}>
            View Shared Trip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl w-full px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">
          {isShared ? 'Join Shared Trip' : 'Request a Ride'}
        </h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">
          {isShared ? 'Set your pickup and drop-off to join the trip' : 'Set your pickup, drop-off, and verify with selfie'}
        </p>
      </div>

      {error && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{error}</p>}

      <div className="flex items-start justify-start gap-2 mb-6 text-xs">
        <span className={stepClass('pickup')}>Pickup</span>
        <span className="text-text-light">&rarr;</span>
        <span className={stepClass('dropoff')}>Drop-off</span>
        <span className="text-text-light">&rarr;</span>
        <span className={stepClass('selfie')}>Selfie</span>
        <span className="text-text-light">&rarr;</span>
        <span className={stepClass('payment')}>Payment</span>
      </div>

      {step === 'pickup' && (
        <div>
          {nearbyDrivers.length > 0 && (
            <p className="text-sm text-text-muted mb-2">
              {nearbyDrivers.length} driver{nearbyDrivers.length > 1 ? 's' : ''} nearby
            </p>
          )}
          {serviceAreas.length > 0 && (
            <p className="text-xs text-text-muted mb-1">
              Service area{serviceAreas.length > 1 ? 's' : ''} shown on map
            </p>
          )}
          <MapLocationPicker
            label="Click on the map to set your pickup location"
            onSelect={(pos) => {
              setPickup(pos);
              reverseGeocode(pos.lat, pos.lng).then(setPickupAddress);
            }}
            initialPosition={pickup || position}
            userLocation={position}
            serviceAreas={serviceAreas}
          />
          {pickup && (
            <div className="mt-3">
              <p className="text-xs text-text-muted mt-1.5 truncate max-w-full">{pickupAddress || `Pickup: ${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}`}</p>
              <button className="inline-flex btn-primary items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-2" onClick={() => setStep('dropoff')}>
                Next: Set Drop-off
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'dropoff' && (
        <div>
          <MapLocationPicker
            label="Click on the map to set your drop-off location"
            onSelect={(pos) => {
              setDropoff(pos);
              reverseGeocode(pos.lat, pos.lng).then(setDropoffAddress);
            }}
            initialPosition={dropoff || pickup || position}
            otherMarker={pickup}
            userLocation={position}
          />
          {dropoff && (
            <div className="mt-3">
              <p className="text-xs text-text-muted mt-1.5 truncate max-w-full">
                {dropoffAddress || `Drop-off: ${dropoff.lat.toFixed(4)}, ${dropoff.lng.toFixed(4)}`}
                {distance && ` · ${distance} km`}
              </p>
              <div className="mt-3 rounded-sm overflow-hidden border-2 border-border">
                <RideRouteMap pickup={pickup} dropoff={dropoff} nearbyDrivers={nearbyDrivers} height="220px" />
              </div>

              {sharedTrips.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-200 to-amber-400 rounded-full" />
                    <span className="text-[0.55rem] font-bold text-amber-600 uppercase tracking-widest whitespace-nowrap">
                      Shared Trips Available Along Your Route
                    </span>
                    <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-400 to-amber-200 rounded-full" />
                  </div>
                  <div className="space-y-3">
                    {sharedTrips.map((trip) => (
                      <div
                        key={trip.tripId}
                        className="bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-200 p-4 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer"
                        onClick={() => handleRequestJoin(trip.tripId)}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-lg font-bold text-amber-600 flex-shrink-0 border-2 border-amber-300 overflow-hidden">
                            {trip.driverPhoto ? (
                              <img src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000'}/${trip.driverPhoto.replace(/\\/g, '/')}`} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = trip.driverName?.[0] || 'D'; }} />
                            ) : (
                              trip.driverName?.[0] || 'D'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1A1A1A] m-0">{trip.driverName || 'Driver'}</p>
                            <p className="text-[0.6rem] text-amber-600 font-semibold m-0 uppercase tracking-wider">Shared Trip</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-amber-700 font-mono m-0">{trip.pricePerSeat} PKR</p>
                            <p className="text-[0.55rem] text-[#8B8B9E] m-0">per seat</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#8B8B9E] mb-2">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="M5 17h14M5 12h14M5 7h14" /></svg>
                            <AddressLabel address={trip.pickupAddress} lat={0} lng={0} />
                          </span>
                          <span>→</span>
                          <span className="flex items-center gap-1 truncate">
                            <svg className="w-3 h-3 text-[#1A1A1A] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="M5 17h14M5 12h14M5 7h14" /></svg>
                            <AddressLabel address={trip.dropoffAddress} lat={0} lng={0} />
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[0.55rem] font-bold">
                              <span className="relative flex w-2 h-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                              </span>
                              {trip.availableSeats} {trip.availableSeats === 1 ? 'seat' : 'seats'} left
                            </span>
                            <span className="text-[0.55rem] text-[#8B8B9E]">
                              {new Date(trip.departureTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRequestJoin(trip.tripId); }}
                            className="bg-amber-500 text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-amber-600 transition cursor-pointer border-none"
                          >
                            Request to Join
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition flex-1" onClick={() => { setStep('pickup'); setDropoff(null); }}>Back</button>
                <button className="inline-flex btn-primary items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={() => isShared ? setStep('payment') : setStep('selfie')}>
                  {isShared ? 'Next: Confirm' : 'Next: Selfie'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'selfie' && !isShared && (
        <div>
          <p className="text-sm text-text-muted mb-4">Capture a selfie to verify your identity. This is required before requesting a ride.</p>
          <SelfieCapture onCapture={handleSelfieCapture} />
          {selfieDataUrl && <p className="text-success  text-sm mt-2">Selfie captured</p>}
          <div className="flex gap-2 mt-4">
            <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition flex-1" onClick={() => setStep('dropoff')}>Back</button>
            <button className="inline-flex btn-primary items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={() => setStep('payment')} disabled={!selfieDataUrl}>
              Next: Payment
            </button>
          </div>
        </div>
      )}
      {step === 'selfie' && isShared && (
        <div>
          <p className="text-sm text-text-muted mb-4">Selfie verification is not needed for shared trips. Proceed to confirm your request.</p>
          <div className="flex gap-2 mt-4">
            <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition flex-1" onClick={() => setStep('dropoff')}>Back</button>
            <button className="inline-flex btn-primary items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={() => setStep('payment')}>
              Next: Review & Confirm
            </button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div>
          <div className="mb-6">
            <h3 className="font-display text-base font-semibold m-0 mb-2">Trip Summary</h3>
            <div className="mb-3 rounded-sm overflow-hidden border-2 border-border">
              <RideRouteMap pickup={pickup} dropoff={dropoff} nearbyDrivers={nearbyDrivers} height="180px" />
            </div>
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Distance</span>
                <span className="font-medium text-plum font-mono">{distance ? `${distance} km` : 'N/A'}</span>
              </div>
            </div>
            {!isShared && (
              <div className="mb-4">
                <label className="label text-sm font-semibold">Your Offer (PKR)</label>
                <p className="text-xs text-text-muted mb-2">Set the amount you're willing to pay. Nearby drivers will bid on your ride.</p>
                <input className="input text-lg font-mono font-bold text-center" type="number" min="50" step="10" placeholder="e.g. 500" value={passengerOffer} onChange={(e) => setPassengerOffer(e.target.value)} />
                {paymentMethod === 'wallet' && walletBalance !== null && passengerOffer && parseFloat(passengerOffer) > walletBalance && (
                  <p className="text-xs text-error mt-1">Exceeds wallet balance ({walletBalance.toFixed(0)} PKR). Top up or choose cash.</p>
                )}
              </div>
            )}
            {isShared && selectedTrip && (
              <div className="mb-4 bg-amber-50 p-4 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-amber-800">Shared Trip Price</span>
                  <span className="text-lg font-bold text-amber-700 font-mono">{selectedTrip.pricePerSeat} PKR</span>
                </div>
                <p className="text-[0.6rem] text-amber-600 mt-1">Fixed price per seat for this shared trip</p>
              </div>
            )}
          </div>

          {!isShared && (
            <>
              <h3 className="font-display text-base font-semibold m-0 mb-3">Payment Method</h3>
              <div
                className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm cursor-pointer transition text-sm mb-2 ${paymentMethod === 'cash'
                  ? 'border-pink bg-pink-subtle text-pink font-semibold'
                  : 'border-border text-text bg-off-white hover:border-pink'
                  }`}
                onClick={() => setPaymentMethod('cash')}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-[1.3rem]">&#x1F4B5;</span>
                  <div className="text-left flex-1">
                    <div className="font-semibold">Cash</div>
                    <div className="text-xs text-text-muted">Pay the driver in cash after the ride</div>
                  </div>
                  {paymentMethod === 'cash' && <span className="text-pink font-bold text-sm">Selected</span>}
                </div>
              </div>
              <div
                className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm transition text-sm mb-2 ${!stripeConfigured ? 'border-border bg-[#f9f9f9] text-text-light opacity-60 cursor-not-allowed' : paymentMethod === 'stripe'
                  ? 'border-pink bg-pink-subtle text-pink font-semibold cursor-pointer'
                  : 'border-border text-text bg-off-white hover:border-pink cursor-pointer'
                  }`}
                onClick={() => stripeConfigured && setPaymentMethod('stripe')}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-[1.3rem]">&#x1F4B3;</span>
                  <div className="text-left flex-1">
                    <div className="font-semibold">{!stripeConfigured ? 'Stripe / Card' : 'Stripe / Card'}</div>
                    <div className="text-xs text-text-muted">{!stripeConfigured ? 'Not configured — pay with cash instead' : 'Pay online with credit/debit card'}</div>
                  </div>
                  {paymentMethod === 'stripe' && <span className="text-pink font-bold text-sm">Selected</span>}
                  {!stripeConfigured && <span className="text-text-light font-bold text-[0.65rem] uppercase tracking-wider">Unavailable</span>}
                </div>
              </div>
              <div
                className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm text-sm mb-2 ${fare && walletBalance !== null && walletBalance < fare
                  ? 'border-border bg-[#f9f9f9] text-text-light opacity-60 cursor-not-allowed'
                  : paymentMethod === 'wallet'
                    ? 'border-pink bg-pink-subtle text-pink font-semibold cursor-pointer'
                    : 'border-border text-text bg-off-white hover:border-pink cursor-pointer'
                  }`}
                onClick={() => {
                  if (!(fare && walletBalance !== null && walletBalance < fare)) {
                    setPaymentMethod('wallet');
                  }
                }}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-[1.3rem]">&#x1F4B0;</span>
                  <div className="text-left flex-1">
                    <div className="font-semibold">Wallet</div>
                    <div className="text-xs text-text-muted">
                      {walletBalance !== null
                        ? `Balance: ${walletBalance.toLocaleString()} PKR${fare && walletBalance < fare ? ' — insufficient, top up in Wallet' : ''}`
                        : 'Pay from your PinkDrive wallet'}
                    </div>
                  </div>
                  {paymentMethod === 'wallet' && !(fare && walletBalance !== null && walletBalance < fare) && <span className="text-pink font-bold text-sm">Selected</span>}
                  {fare && walletBalance !== null && walletBalance < fare && <span className="text-text-light font-bold text-[0.65rem] uppercase tracking-wider">Insufficient</span>}
                </div>
              </div>
            </>
          )}

           <div className="flex gap-2 mt-6">
             <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition flex-1" onClick={() => setStep('selfie')}>Back</button>
             <button className="inline-flex items-center btn-primary justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={isShared ? () => handleRequestJoin(tripId) : handleSubmit} disabled={loading || !pickup || !dropoff || (!isShared && (!selfieDataUrl || !passengerOffer || (paymentMethod === 'wallet' && walletBalance !== null && parseFloat(passengerOffer) > walletBalance)))}>
               {loading ? 'Requesting...' : (isShared ? 'Confirm Request' : (paymentMethod === 'wallet' && walletBalance !== null && passengerOffer && parseFloat(passengerOffer) > walletBalance) ? 'Insufficient Wallet' : 'Request Ride')}
             </button>
           </div>
        </div>
      )}
    </div>
  );
}

function RequestRide() {
  return (
    <LocationGate>
      <RequestRideInner />
    </LocationGate>
  );
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default RequestRide;
