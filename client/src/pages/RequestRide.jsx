import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import MapLocationPicker from '../components/MapLocationPicker';
import RideRouteMap from '../components/RideRouteMap';
import SelfieCapture from '../components/SelfieCapture';
import LocationGate from '../components/LocationGate';
import useGeolocation from '../hooks/useGeolocation';

const FARE_PER_KM = 50;

function RequestRideInner() {
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [step, setStep] = useState('pickup');
  const [selfieDataUrl, setSelfieDataUrl] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { position } = useGeolocation();

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
    setLoading(true);
    setError('');
    try {
      const blob = await (await fetch(selfieDataUrl)).blob();
      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');
      const selfieRes = await rideAPI.uploadTempSelfie(formData);
      await rideAPI.createRide({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        selfiePath: selfieRes.data.data.selfiePath,
        paymentMethod,
      });
      navigate('/ride/active');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create ride.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Request a Ride</h1>
        <p className="page-subtitle">Set your pickup, drop-off, and verify with selfie</p>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="step-indicator">
        <span className={`step ${step === 'pickup' ? 'active' : pickup ? 'done' : ''}`}>Pickup</span>
        <span className="step-arrow">&rarr;</span>
        <span className={`step ${step === 'dropoff' ? 'active' : dropoff ? 'done' : ''}`}>Drop-off</span>
        <span className="step-arrow">&rarr;</span>
        <span className={`step ${step === 'selfie' ? 'active' : selfieDataUrl ? 'done' : ''}`}>Selfie</span>
        <span className="step-arrow">&rarr;</span>
        <span className={`step ${step === 'payment' ? 'active' : ''}`}>Payment</span>
      </div>

      {step === 'pickup' && (
        <div>
          {nearbyDrivers.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {nearbyDrivers.length} driver{nearbyDrivers.length > 1 ? 's' : ''} nearby
            </p>
          )}
          <MapLocationPicker
            label="Click on the map to set your pickup location"
            onSelect={(pos) => setPickup(pos)}
            initialPosition={pickup || position}
          />
          {pickup && (
            <div style={{ marginTop: '0.75rem' }}>
              <p className="coord-display">Pickup: {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}</p>
              <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => setStep('dropoff')}>
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
            onSelect={(pos) => setDropoff(pos)}
            initialPosition={dropoff}
            otherMarker={pickup}
          />
          {dropoff && (
            <div style={{ marginTop: '0.75rem' }}>
              <p className="coord-display">
                Drop-off: {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
                {distance && ` · ${distance} km`}
              </p>
              <div style={{ marginTop: '0.75rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                <RideRouteMap pickup={pickup} dropoff={dropoff} nearbyDrivers={nearbyDrivers} height="220px" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setStep('pickup'); setDropoff(null); }}>Back</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep('selfie')}>
                  Next: Selfie
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'selfie' && (
        <div>
          <p className="verify-subtitle">Capture a selfie to verify your identity. This is required before requesting a ride.</p>
          <SelfieCapture onCapture={handleSelfieCapture} />
          {selfieDataUrl && <p style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Selfie captured</p>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep('dropoff')}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep('payment')} disabled={!selfieDataUrl}>
              Next: Payment
            </button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
              Trip Summary
            </h3>
            <div style={{ marginBottom: '0.75rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
              <RideRouteMap pickup={pickup} dropoff={dropoff} nearbyDrivers={nearbyDrivers} height="180px" />
            </div>
            <div className="ride-card-details">
              <div className="ride-detail">
                <span className="ride-detail-label">Distance</span>
                <span className="ride-detail-value">{distance ? `${distance} km` : 'N/A'}</span>
              </div>
              <div className="ride-detail">
                <span className="ride-detail-label">Fare</span>
                <span className="ride-detail-value" style={{ fontWeight: 700, color: 'var(--plum)' }}>
                  {fare ? `${fare} PKR` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
            Payment Method
          </h3>

          <div
            className={`role-option ${paymentMethod === 'cash' ? 'active' : ''}`}
            style={{ marginBottom: '0.5rem', cursor: 'pointer' }}
            onClick={() => setPaymentMethod('cash')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
              <span style={{ fontSize: '1.3rem' }}>💵</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Cash</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pay the driver in cash after the ride</div>
              </div>
              {paymentMethod === 'cash' && <span style={{ color: 'var(--pink)', fontWeight: 700 }}>Selected</span>}
            </div>
          </div>

          <div
            className="role-option"
            style={{ marginBottom: '0.5rem', opacity: 0.5, cursor: 'not-allowed' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
              <span style={{ fontSize: '1.3rem' }}>💳</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Stripe / Card</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pay online with credit/debit card</div>
              </div>
              <span style={{ fontSize: '0.7rem', background: 'var(--pink-subtle)', color: 'var(--pink)', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 600 }}>Coming soon</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep('selfie')}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={loading || !pickup || !dropoff || !selfieDataUrl}>
              {loading ? 'Requesting...' : 'Request Ride'}
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
