import useGeolocation from '../hooks/useGeolocation';

function LocationGate({ children }) {
  const { permissionState, error, request, isDenied, isGranted } = useGeolocation();

  if (isDenied) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Location Required</h1>
        </div>
        <div className="auth-card">
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
            <h3 style={{ fontFamily: 'var(--font-display)', margin: '0 0 0.5rem', color: 'var(--plum)' }}>
              Location Access Required
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {error || 'Location access is needed to use ride features. Please enable it in your browser settings.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isGranted) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Location Required</h1>
        </div>
        <div className="auth-card">
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
            <h3 style={{ fontFamily: 'var(--font-display)', margin: '0 0 0.5rem', color: 'var(--plum)' }}>
              Enable Location Access
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              This page needs your location to work properly. Click below to allow location access.
            </p>
            {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', margin: '0.5rem 0' }}>{error}</p>}
            <button className="btn btn-primary btn-large" style={{ marginTop: '1rem' }} onClick={request}>
              Enable Location
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

export default LocationGate;
