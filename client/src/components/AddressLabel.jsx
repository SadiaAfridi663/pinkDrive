import { useState, useEffect } from 'react';
import { reverseGeocode } from '../utils/geocode';

function AddressLabel({ address, lat, lng, className = '' }) {
  const [resolved, setResolved] = useState(address || '');

  useEffect(() => {
    if (address) { setResolved(address); return; }
    if (lat == null || lng == null) { setResolved(''); return; }
    let mounted = true;
    reverseGeocode(lat, lng).then((a) => { if (mounted) setResolved(a); });
    return () => { mounted = false; };
  }, [address, lat, lng]);

  if (!resolved) return <span className={className}>—</span>;
  return <span className={`${className} truncate`} title={resolved}>{resolved}</span>;
}

export default AddressLabel;
