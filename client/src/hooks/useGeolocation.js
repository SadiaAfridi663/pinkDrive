import { useState, useEffect, useCallback, useRef } from 'react';

const STATES = {
  PROMPT: 'prompt',
  GRANTED: 'granted',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
};

function useGeolocation() {
  const [permissionState, setPermissionState] = useState(null);
  const [resolved, setResolved] = useState(false);
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const requestedRef = useRef(false);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setPermissionState(STATES.UNAVAILABLE);
      setError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermissionState(STATES.GRANTED);
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState(STATES.DENIED);
          setError('Location access denied. Enable it in your browser settings to use ride features.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Location unavailable. Try again.');
        } else {
          setError('Location request timed out.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const startWatching = useCallback((onPosition) => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current != null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(loc);
        onPosition?.(loc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!navigator.permissions) {
      setResolved(true);
      if (navigator.geolocation && !requestedRef.current) {
        requestedRef.current = true;
        request();
      }
      return;
    }
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setPermissionState(result.state);
      setResolved(true);
      if (result.state === 'granted' && !requestedRef.current) {
        requestedRef.current = true;
        request();
      }
      result.addEventListener('change', () => {
        setPermissionState(result.state);
        if (result.state === 'granted' && !requestedRef.current) {
          requestedRef.current = true;
          request();
        }
      });
    }).catch(() => { setResolved(true); });
  }, [request]);

  useEffect(() => {
    return () => stopWatching();
  }, [stopWatching]);

  return {
    permissionState,
    position,
    error,
    isChecking: permissionState === null && !resolved,
    isAvailable: permissionState !== STATES.UNAVAILABLE,
    isDenied: permissionState === STATES.DENIED,
    isGranted: permissionState === STATES.GRANTED,
    request,
    startWatching,
    stopWatching,
  };
}

export default useGeolocation;
