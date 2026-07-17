/**
 * Socket.IO event name constants.
 * Mirror of server/sockets/events.js — keep in sync.
 */

// ─── Rooms ───────────────────────────────────────
export const ROOMS = {
  USER: (userId) => `user:${userId}`,
  DRIVER: (driverId) => `driver:${driverId}`,
  PASSENGER: (passengerId) => `passenger:${passengerId}`,
  RIDE: (rideId) => `ride:${rideId}`,
  TRIP: (tripId) => `trip:${tripId}`,
  ADMIN: 'admin-room',
};

// ─── Client → Server (outgoing) ─────────────────
export const CLIENT_EVENTS = {
  DRIVER_READY: 'driver:ready',
  JOIN_RIDE: 'join:ride',
  LEAVE_RIDE: 'leave:ride',
  LOCATION_UPDATE: 'location:update',
  DRIVER_OFFER: 'driver:offer',
  ACCEPT_OFFER: 'accept:offer',
  JOIN_USER: 'join:user',
  JOIN_TRIP: 'join:trip',
  LEAVE_TRIP: 'leave:trip',
  TRIP_LISTEN: 'trip:listen',
  TRIP_PASSENGER_LISTEN: 'trip:passenger:listen',
};

// ─── Server → Client (incoming) ─────────────────
export const SERVER_EVENTS = {
  // Driver discovery
  DRIVERS_ONLINE: 'drivers:online',
  RIDE_AVAILABLE: 'ride:available',

  // Bidding
  NEW_OFFER: 'new:offer',
  OFFER_SENT: 'offer:sent',
  OFFER_ERROR: 'offer:error',
  OFFER_EXPIRED: 'offer:expired',
  OFFER_ACCEPTED: 'offer:accepted',
  ACCEPT_REDIRECT: 'accept:redirect',

  // Ride status & location
  RIDE_STATUS: 'ride:status',
  DRIVER_LOCATION: 'driver:location',
  PASSENGER_LOCATION: 'passenger:location',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',

  // SOS
  SOS_ALERT: 'sos:alert',
  SOS_RESOLVED: 'sos:resolved',

  // Shared trip lifecycle
  TRIP_CREATED: 'trip:created',
  TRIP_REQUEST_NEW: 'trip:request:new',
  TRIP_REQUEST_ACCEPTED: 'trip:request:accepted',
  TRIP_REQUEST_DECLINED: 'trip:request:declined',
  TRIP_REQUEST_CANCELLED: 'trip:request:cancelled',
  TRIP_SEATS_UPDATE: 'trip:seats:update',
  TRIP_CANCELLED: 'trip:cancelled',
  TRIP_STATUS: 'trip:status',

  // — Planned for future phases —
  PASSENGER_BOARDED: 'passenger:boarded',
  PASSENGER_DROPPED: 'passenger:dropped',
  DRIVER_ARRIVING: 'driver:arriving',
  PASSENGER_JOINED: 'passenger:joined',
  PASSENGER_LEFT: 'passenger:left',
  PASSENGER_REMOVED: 'passenger:removed',
};
