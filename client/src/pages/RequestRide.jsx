import { useState, useCallback, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI, serviceAreaAPI, paymentsAPI, walletAPI, sharedTripAPI } from '../services/api';
import MapLocationPicker from '../components/MapLocationPicker';
import RideRouteMap from '../components/RideRouteMap';
import AddressLabel from '../components/AddressLabel';
import SelfieCapture from '../components/SelfieCapture';
import SharedTripCard from '../components/SharedTripCard';
import LocationGate from '../components/LocationGate';
import useGeolocation from '../hooks/useGeolocation';
import { reverseGeocode } from '../utils/geocode';
import { AuthContext } from '../context/AuthContext';

const FARE_PER_KM = 50;

function PrivateRideFlow({
  pickup, setPickup, pickupAddress, setPickupAddress,
  dropoff, setDropoff, dropoffAddress, setDropoffAddress,
  step, setStep, selfieDataUrl, setSelfieDataUrl,
  paymentMethod, setPaymentMethod,
  nearbyDrivers, serviceAreas, stripeConfigured, walletBalance,
  passengerOffer, setPassengerOffer, error, setError,
  loading, setLoading, distance, position,
}) {
  const navigate = useNavigate();

  const handleSelfieCapture = useCallback((dataUrl) => setSelfieDataUrl(dataUrl), [setSelfieDataUrl]);

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">
          Request a Ride
        </h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">
          Set your pickup, drop-off, and verify with selfie
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

              <div className="flex gap-2 mt-4">
                <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition flex-1" onClick={() => { setStep('pickup'); setDropoff(null); }}>Back</button>
                <button className="inline-flex btn-primary items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={() => setStep('selfie')}>
                  Next: Selfie
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'selfie' && (
        <div>
          <p className="text-sm text-text-muted mb-4">Capture a selfie to verify your identity. This is required before requesting a ride.</p>
          <SelfieCapture onCapture={handleSelfieCapture} />
          {selfieDataUrl && <p className="text-success text-sm mt-2">Selfie captured</p>}
          <div className="flex gap-2 mt-4">
            <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition flex-1" onClick={() => setStep('dropoff')}>Back</button>
            <button className="inline-flex btn-primary items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={() => setStep('payment')} disabled={!selfieDataUrl}>
              Next: Payment
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
            <div className="mb-4">
              <label className="label text-sm font-semibold">Your Offer (PKR)</label>
              <p className="text-xs text-text-muted mb-2">Set the amount you're willing to pay. Nearby drivers will bid on your ride.</p>
              <input className="input text-lg font-mono font-bold text-center" type="number" min="50" step="10" placeholder="e.g. 500" value={passengerOffer} onChange={(e) => setPassengerOffer(e.target.value)} />
              {paymentMethod === 'wallet' && walletBalance !== null && passengerOffer && parseFloat(passengerOffer) > walletBalance && (
                <p className="text-xs text-error mt-1">Exceeds wallet balance ({walletBalance.toFixed(0)} PKR). Top up or choose cash.</p>
              )}
            </div>
          </div>

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

          <div className="flex gap-2 mt-6">
            <button className="bg-transparent border-2 border-border text-text-muted hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-5 py-2.5 cursor-pointer transition flex-1" onClick={() => setStep('selfie')}>Back</button>
            <button className="inline-flex items-center btn-primary justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex-1" onClick={handleSubmit} disabled={loading || !pickup || !dropoff || !selfieDataUrl || !passengerOffer || (paymentMethod === 'wallet' && walletBalance !== null && parseFloat(passengerOffer) > walletBalance)}>
              {loading ? 'Requesting...' : (paymentMethod === 'wallet' && walletBalance !== null && passengerOffer && parseFloat(passengerOffer) > walletBalance) ? 'Insufficient Wallet' : 'Request Ride'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SharedTripFlow({
  walletBalance, serviceAreas, onRequestJoin, loading, position,
}) {
  const [pickup, setPickup] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoff, setDropoff] = useState(null);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [requestedSeats, setRequestedSeats] = useState(1);
  const [results, setResults] = useState([]);
  const [step, setStep] = useState('details');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [joinLoading, setJoinLoading] = useState(null);
  const [walletError, setWalletError] = useState(null);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!pickup || !dropoff) return;
    setSearching(true);
    setError('');
    try {
      const res = await sharedTripAPI.getAvailable(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
      const trips = (res.data.data.trips || []).map(t => ({
        ...t,
        tripId: t.id,
      }));
      setResults(trips);
      if (trips.length === 0) {
        setError('No shared trips found along this route.');
      }
      setStep('results');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search shared trips.');
    } finally {
      setSearching(false);
    }
  };

  const handleJoin = async (tripId) => {
    const trip = results.find(t => t.id === tripId || t.tripId === tripId);
    if (trip?.paymentMethod === 'wallet') {
      if (walletBalance === null || walletBalance < parseFloat(trip.pricePerSeat) * requestedSeats) {
        setWalletError({
          balance: walletBalance ?? 0,
          required: parseFloat(trip.pricePerSeat) * requestedSeats,
          tripId,
        });
        return;
      }
    }
    setJoinLoading(tripId);
    try {
      await sharedTripAPI.requestJoin(tripId, {
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        requestedSeats,
      });
      navigate('/passenger');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to join shared trip.';
      setError(msg);
      setJoinLoading(null);
    }
  };

  const handleBackToDetails = () => {
    setStep('details');
    setError('');
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">
          Find a Shared Trip
        </h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">
          Search for available shared trips along your route
        </p>
      </div>

      {error && (
        <p className={`px-3.5 py-2.5 rounded-sm text-sm mb-4 ${
          step === 'results' && results.length > 0
            ? 'bg-[#fff5f5] text-error border border-[#ffcdd2]'
            : error === 'No shared trips found along this route.'
              ? 'bg-[#FFF8FA] text-[#8B6F80] border border-[#EDE4EB] text-center'
              : 'bg-[#fff5f5] text-error border border-[#ffcdd2]'
        }`}>
          {error}
        </p>
      )}

      {step === 'details' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Pickup Location</label>
            <div className="h-56 rounded-xl overflow-hidden border border-[#EDE4EB]">
              <MapLocationPicker
                onSelect={(pos) => {
                  setPickup(pos);
                  reverseGeocode(pos.lat, pos.lng).then(setPickupAddress);
                }}
                initialPosition={pickup || position}
                userLocation={position}
                serviceAreas={serviceAreas}
              />
            </div>
            {pickup && (
              <p className="text-xs text-[#8B6F80] mt-1.5">
                <AddressLabel address={pickupAddress} lat={pickup.lat} lng={pickup.lng} />
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Dropoff Location</label>
            <div className="h-56 rounded-xl overflow-hidden border border-[#EDE4EB]">
              <MapLocationPicker
                onSelect={(pos) => {
                  setDropoff(pos);
                  reverseGeocode(pos.lat, pos.lng).then(setDropoffAddress);
                }}
                initialPosition={dropoff || pickup || position}
                otherMarker={pickup}
                userLocation={position}
              />
            </div>
            {dropoff && (
              <p className="text-xs text-[#8B6F80] mt-1.5">
                <AddressLabel address={dropoffAddress} lat={dropoff.lat} lng={dropoff.lng} />
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Seats Required
            </label>
            <p className="text-xs text-[#8B6F80] mb-3">
              How many seats do you need for this trip?
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setRequestedSeats(n)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition cursor-pointer ${
                    requestedSeats === n
                      ? 'bg-[#FCE4EC] border-[#E91E8C] text-[#E91E8C]'
                      : 'bg-white border-[#EDE4EB] text-[#8B6F80] hover:border-[#E91E8C]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={!pickup || !dropoff || searching}
            className="w-full py-3.5 bg-[#E91E8C] text-white font-bold text-sm tracking-wide rounded-xl border-none cursor-pointer transition-all duration-200 hover:bg-[#C2185B] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {searching ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" /></svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                Find Shared Trips
              </>
            )}
          </button>
        </div>
      )}

      {step === 'results' && results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-[#1A1A1A] m-0">
                {results.length} Matching Shared Trip{results.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-[#8B6F80] m-0 mt-0.5">
                Along your route from <span className="font-medium text-[#1A1A1A]"><AddressLabel address={pickupAddress} lat={pickup?.lat} lng={pickup?.lng} /></span> to <span className="font-medium text-[#1A1A1A]"><AddressLabel address={dropoffAddress} lat={dropoff?.lat} lng={dropoff?.lng} /></span>
              </p>
            </div>
            <button
              onClick={handleBackToDetails}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#8B6F80] bg-transparent border border-[#EDE4EB] rounded-lg px-3 py-2 cursor-pointer hover:border-[#E91E8C] hover:text-[#E91E8C] transition flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              Edit Search
            </button>
          </div>

          <div className="space-y-4">
            {results.map((trip, index) => (
              <div key={trip.id || trip.tripId} style={{ animationDelay: `${index * 80}ms` }}>
                <SharedTripCard
                  trip={trip}
                  requestedSeats={requestedSeats}
                  passengerPickup={pickup}
                  passengerDropoff={dropoff}
                  onRequestJoin={handleJoin}
                  disabled={joinLoading === (trip.id || trip.tripId)}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleBackToDetails}
            className="w-full mt-4 py-3 rounded-xl border-2 border-[#EDE4EB] text-[#8B6F80] font-semibold text-sm bg-transparent cursor-pointer hover:border-[#E91E8C] hover:text-[#E91E8C] transition"
          >
            Back to Search
          </button>
        </div>
      )}

      {walletError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setWalletError(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto mb-4 w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
              </div>
              <h3 className="text-lg font-bold text-[#880E4F] m-0 mb-2">Insufficient Wallet Balance</h3>
              <p className="text-sm text-[#8B8B9E] m-0 mb-1">
                Your wallet balance is <strong className="text-[#1A1A1A]">{walletError.balance} PKR</strong>.
              </p>
              <p className="text-sm text-[#8B8B9E] m-0 mb-6">
                You need at least <strong className="text-[#1A1A1A]">{walletError.required} PKR</strong> to join this ride.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setWalletError(null)}
                  className="flex-1 py-3 rounded-xl border-2 border-[#F0E0E8] text-[#880E4F] font-semibold text-sm hover:border-[#E91E8C] transition cursor-pointer bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setWalletError(null); navigate('/passenger?tab=wallet'); }}
                  className="flex-1 py-3 rounded-xl bg-[#E91E8C] text-white font-bold text-sm hover:bg-[#C2185B] transition cursor-pointer border-none"
                >
                  Add Money
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestRideInner() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('private');
  const [activeBlock, setActiveBlock] = useState(null);
  const [activeRequestId, setActiveRequestId] = useState(null);

  const { position } = useGeolocation();

  // ===== Private Ride State =====
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

  // ===== Shared State (check for active ride/trip on mount) =====
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

  // ===== Shared Data Fetching =====
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

  const distance = pickup && dropoff
    ? Math.round(haversine(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) * 100) / 100
    : null;
  const fare = distance ? Math.round(distance * FARE_PER_KM * 100) / 100 : null;

  // ===== Active Block Screens =====
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

  if (activeBlock === null) {
    return (
      <div className="max-w-2xl w-full px-6 py-8 pb-16 flex items-center justify-center min-h-[300px]">
        <svg className="w-8 h-8 text-[#E91E8C] animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" /></svg>
      </div>
    );
  }

  // ===== Tab Control =====
  return (
    <div className="max-w-2xl w-full px-6 py-8 pb-16">
      <div className="relative mb-8">
        <div className="bg-[#F5F0F3] rounded-2xl p-1 flex relative">
          <div
            className={`absolute top-1 bottom-1 rounded-xl bg-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              activeTab === 'private' ? 'left-1 right-[calc(50%+2px)]' : 'left-[calc(50%+2px)] right-1'
            }`}
          />
          <button
            onClick={() => setActiveTab('private')}
            className={`flex-1 relative z-10 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer border-none ${
              activeTab === 'private'
                ? 'text-[#E91E8C]'
                : 'text-[#8B6F80] hover:text-[#1A1A1A]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
              Private Ride
            </span>
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`flex-1 relative z-10 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer border-none ${
              activeTab === 'shared'
                ? 'text-[#E91E8C]'
                : 'text-[#8B6F80] hover:text-[#1A1A1A]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
              Shared Trip
            </span>
          </button>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'private' ? (
          <PrivateRideFlow
            pickup={pickup} setPickup={setPickup}
            pickupAddress={pickupAddress} setPickupAddress={setPickupAddress}
            dropoff={dropoff} setDropoff={setDropoff}
            dropoffAddress={dropoffAddress} setDropoffAddress={setDropoffAddress}
            step={step} setStep={setStep}
            selfieDataUrl={selfieDataUrl} setSelfieDataUrl={setSelfieDataUrl}
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
            nearbyDrivers={nearbyDrivers}
            serviceAreas={serviceAreas}
            stripeConfigured={stripeConfigured}
            walletBalance={walletBalance}
            passengerOffer={passengerOffer} setPassengerOffer={setPassengerOffer}
            error={error} setError={setError}
            loading={loading} setLoading={setLoading}
            distance={distance}
            position={position}
          />
        ) : (
          <SharedTripFlow
            walletBalance={walletBalance}
            serviceAreas={serviceAreas}
            position={position}
          />
        )}
      </div>
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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default RequestRide;
