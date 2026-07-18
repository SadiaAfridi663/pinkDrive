import { useState, useEffect } from 'react';
import AddressLabel from './AddressLabel';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

const FARE_PER_KM = 50;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function SharedTripCard({ trip, requestedSeats, passengerPickup, passengerDropoff, onRequestJoin, disabled }) {
  const [imgError, setImgError] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const distance = passengerPickup
    ? Math.round(haversine(
        passengerPickup.lat, passengerPickup.lng,
        trip.pickupLat, trip.pickupLng
      ) * 10) / 10
    : null;

  const totalFare = (trip.pricePerSeat || 0) * (requestedSeats || 1);

  const photoUrl = trip.driverPhoto && !imgError
    ? (trip.driverPhoto.startsWith('http') ? trip.driverPhoto : `${API_URL}/${trip.driverPhoto.replace(/\\/g, '/')}`)
    : null;

  const initials = trip.driverName
    ? trip.driverName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'DR';

  return (
    <div
      className={`bg-white rounded-2xl border border-[#EDE4EB] shadow-sm overflow-hidden transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } hover:shadow-md hover:border-[#DDB8D0] group`}
    >
      <div className="p-4 lg:p-5">
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FCE4EC] to-[#F8BBD0] flex-shrink-0 overflow-hidden ring-2 ring-[#FCE4EC]">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[#880E4F]">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#1A1A1A] m-0 truncate">{trip.driverName || 'Driver'}</p>
              <span className="flex items-center gap-1 text-xs font-semibold text-[#8B6F80] flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                {trip.driverRating || '4.5'}
              </span>
            </div>
            <p className="text-xs text-[#8B6F80] m-0 mt-0.5">
              {trip.vehicleInfo || 'Shared Trip'}
            </p>
          </div>
        </div>

        <div className="relative pl-5 pb-2 mb-3 border-l-2 border-[#EDE4EB]">
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#E91E8C] ring-2 ring-[#FCE4EC]" />
          <p className="text-[0.7rem] font-semibold text-[#8B6F80] uppercase tracking-wider m-0 mb-0.5">Pickup</p>
          <p className="text-xs text-[#1A1A1A] m-0 truncate leading-snug">
            <AddressLabel address={trip.pickupAddress} lat={trip.pickupLat} lng={trip.pickupLng} />
          </p>
        </div>
        <div className="relative pl-5 mb-3 border-l-2 border-[#EDE4EB]">
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#1A1A1A] ring-2 ring-[#F0E0E8]" />
          <p className="text-[0.7rem] font-semibold text-[#8B6F80] uppercase tracking-wider m-0 mb-0.5">Dropoff</p>
          <p className="text-xs text-[#1A1A1A] m-0 truncate leading-snug">
            <AddressLabel address={trip.dropoffAddress} lat={trip.dropoffLat} lng={trip.dropoffLng} />
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#8B6F80] mb-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span className="font-medium">
            {new Date(trip.departureTime).toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      <div className="px-4 lg:px-5 py-3 bg-gradient-to-r from-[#FDF8FA] to-[#FFF5F8] border-t border-[#EDE4EB]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[0.6rem] font-semibold text-[#8B6F80] uppercase tracking-wider m-0">Available</p>
              <p className="text-lg font-bold text-[#1A1A1A] font-mono m-0 leading-tight">{trip.availableSeats}</p>
            </div>
            <div className="w-px h-8 bg-[#EDE4EB]" />
            <div className="text-center">
              <p className="text-[0.6rem] font-semibold text-[#E91E8C] uppercase tracking-wider m-0">Needed</p>
              <p className="text-lg font-bold text-[#E91E8C] font-mono m-0 leading-tight">{requestedSeats || 1}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[0.6rem] font-semibold text-[#8B6F80] uppercase tracking-wider m-0">Est. Fare</p>
            <p className="text-lg font-bold text-[#1A1A1A] font-mono m-0 leading-tight">{totalFare.toLocaleString()} <span className="text-xs font-medium text-[#8B6F80]">PKR</span></p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          {distance != null && (
            <div className="flex items-center gap-1 text-[0.6rem] text-[#8B6F80]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <span>{distance} km from your pickup</span>
            </div>
          )}
          <span className="text-[0.6rem] text-[#8B6F80]">
            <span className="font-semibold">{trip.pricePerSeat} PKR</span> / seat
          </span>
        </div>
        {trip.availableSeats < requestedSeats && (
          <p className="text-[0.6rem] text-amber-600 font-semibold mt-2 flex items-center gap-1">
            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            Fewer seats available than requested — driver will decide
          </p>
        )}
      </div>

      <button
        onClick={() => onRequestJoin(trip.id || trip.tripId)}
        disabled={disabled}
        className="w-full py-3.5 bg-[#E91E8C] text-white font-bold text-sm tracking-wide border-none cursor-pointer transition-all duration-200 hover:bg-[#C2185B] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
      >
        {disabled ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" /></svg>
            Requesting...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Request to Join
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </span>
        )}
      </button>
    </div>
  );
}

export default SharedTripCard;
