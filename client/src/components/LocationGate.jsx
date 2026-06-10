import useGeolocation from '../hooks/useGeolocation';

function LocationGate({ children }) {
  const { permissionState, error, request, isDenied, isGranted, isChecking } = useGeolocation();

  if (isChecking) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Location Required</h1>
        </div>
        <div className="card p-8" style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
          <p className="text-stone text-sm">Checking location access...</p>
        </div>
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className="max-w-page mx-auto px-6 py-8 pb-16">
        <div className="mb-8">
          <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Location Required</h1>
        </div>
        <div className="w-full max-w-[400px] bg-white border border-border rounded px-8 py-10">
          <div className="text-center p-8">
            <div className="text-5xl mb-4">&#x1F4CD;</div>
            <h3 className="font-display m-0 mb-2 text-plum">Location Access Required</h3>
            <p className="text-text-muted text-sm leading-[1.5]">
              {error || 'Location access is needed to use ride features. Please enable it in your browser settings.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isGranted) {
    return (
      <div className="max-w-page mx-auto px-6 py-8 pb-16">
        <div className="mb-8">
          <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Location Required</h1>
        </div>
        <div className="w-full max-w-[400px] bg-white border border-border rounded px-8 py-10">
          <div className="text-center p-8">
            <div className="text-5xl mb-4">&#x1F4CD;</div>
            <h3 className="font-display m-0 mb-2 text-plum">Enable Location Access</h3>
            <p className="text-text-muted text-sm leading-[1.5]">
              This page needs your location to work properly. Click below to allow location access.
            </p>
            {error && <p className="text-error text-xs my-2">{error}</p>}
            <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none px-8 py-3.5 text-base rounded mt-4" onClick={request}>
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
