import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../services/api';
import MapLocationPicker from '../components/MapLocationPicker';
import SelfieCapture from '../components/SelfieCapture';

function RequestRide() {
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [step, setStep] = useState('pickup');
  const [selfieDataUrl, setSelfieDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSelfieCapture = (dataUrl) => {
    setSelfieDataUrl(dataUrl);
  };

  const handleSubmit = async () => {
    if (!pickup || !dropoff) {
      setError('Please select both pickup and drop-off locations.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let selfiePath = null;
      if (selfieDataUrl) {
        const blob = await (await fetch(selfieDataUrl)).blob();
        const formData = new FormData();
        formData.append('selfie', blob, 'selfie.jpg');
        const selfieRes = await rideAPI.uploadSelfie('_temp', formData);
        selfiePath = selfieRes.data.data.ride.selfiePath;
      }

      await rideAPI.createRide({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        selfiePath,
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
        <p className="page-subtitle">Set your pickup, drop-off, and verify</p>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="step-indicator">
        <span className={`step ${step === 'pickup' ? 'active' : 'done'}`}>Pickup</span>
        <span className="step-arrow">&rarr;</span>
        <span className={`step ${step === 'dropoff' ? 'active' : step === 'pickup' ? '' : 'done'}`}>Drop-off</span>
        <span className="step-arrow">&rarr;</span>
        <span className={`step ${step === 'selfie' ? 'active' : ''}`}>Selfie</span>
      </div>

      {step === 'pickup' && (
        <div>
          <MapLocationPicker
            label="Click on the map to set your pickup location"
            onSelect={(pos) => { setPickup(pos); }}
            initialPosition={pickup}
          />
          {pickup && (
            <p className="coord-display">
              Pickup: {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
            </p>
          )}
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setStep('dropoff')} disabled={!pickup}>
            Next: Set Drop-off
          </button>
        </div>
      )}

      {step === 'dropoff' && (
        <div>
          <MapLocationPicker
            label="Click on the map to set your drop-off location"
            onSelect={(pos) => { setDropoff(pos); }}
            initialPosition={dropoff}
          />
          {dropoff && (
            <p className="coord-display">
              Drop-off: {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep('pickup')}>
              Back
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep('selfie')} disabled={!dropoff}>
              Next: Selfie
            </button>
          </div>
        </div>
      )}

      {step === 'selfie' && (
        <div>
          <p className="verify-subtitle">Take a selfie to verify your identity (optional but recommended).</p>
          <SelfieCapture onCapture={handleSelfieCapture} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep('dropoff')}>
              Back
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={loading || !pickup || !dropoff}>
              {loading ? 'Requesting...' : 'Request Ride'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequestRide;
