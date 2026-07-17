# Shared Ride System — Audit & Fix Plan

## Root Causes Found During Audit

### Bug #1 & #2: Passengers don't receive `trip:status` events
`trip:status` is emitted to `trip:{tripId}` room, but **no passenger ever joins that room**. Passengers only listen in `passenger:{id}` rooms, and only for `trip:request:accepted/declined/cancelled` — none of which fire on `in_progress` or `completed` transitions.

### Bug #3: Stale state after app restart
Shared trip pages have **no `socket.on('connect')` reconnection handlers**. Unlike `ActiveRide.jsx` (re-fetches on reconnect), `SharedTripDetail.jsx` and `DriverActiveSharedTrip.jsx` have no reconnect logic and don't re-join rooms.

### Missing TripRequest lifecycle
Only 4 states: `pending → accepted/declined/cancelled`. Needs 9 states for full lifecycle.

### Seats not restored
Declining/cancelling a request never increments `availableSeats` back.

### No payment for shared trips
`pricePerSeat` stored but never collected. No Stripe, no wallet, no commission.

### Driver location not broadcast to shared trips
`location:update` handler only broadcasts to `ride:{rideId}` (private rides). `SharedTrip` has no `driverLat/driverLng`.

### Race conditions in seat management
No DB transactions or row-level locking in `acceptRequest`.

### No socket event constants
30+ event names as raw magic strings across 10+ files.

---

## Phases

### ✅ Phase 0 — Database Schema Changes & Migrations (COMPLETED)

Setup:
- Install `sequelize-cli` 
- Create `.sequelizerc` config
- Init migrations folder
- Create migration for TripRequest new fields + expanded status
- Create migration for SharedTrip new fields + expanded status
- Create migration for Transaction `tripRequestId` FK

### ✅ Phase 1 — WebSocket Event Constants (COMPLETED)

Create shared constants files on server and client, refactor all magic strings.

### ✅ Phase 2 — Fix State Synchronization (Bug #1 & #2) (COMPLETED)

Make passengers join `trip:{tripId}` room, listen for `trip:status`, update TripRequests on trip status transitions.

### ✅ Phase 3 — Fix Reconnection (Bug #3) (COMPLETED)

Add `socket.on('connect')` handlers to all shared trip pages. Restore room subscriptions and re-fetch state.

### ✅ Phase 4 — Full Shared Ride Lifecycle (COMPLETED)

Add granular lifecycle endpoints: driver arriving, passenger boarding, passenger dropoff. Expand TripRequest statuses.

### ✅ Phase 5 — Passenger Synchronization (COMPLETED)

Notify all participants when any passenger changes state (joins, cancels, removed). Real-time seat count updates.

### ✅ Phase 6 — Seat Management & Race Conditions (COMPLETED)

`acceptRequest` now uses Sequelize transaction with `t.LOCK.UPDATE` row-level lock. `cancelTrip` also wrapped in transaction. Added `leaveTrip` (passenger self-cancels) and `removePassenger` (driver removes passenger), both with transaction locking and seat restoration.

### ✅ Phase 7 — Driver Location Synchronization (COMPLETED)

Server broadcasts driver location to `trip:{tripId}` room + persists to `SharedTrip.driverLat/driverLng` on every `location:update`. Driver page (`DriverActiveSharedTrip.jsx`) emits periodic location. Passenger page (`SharedTripDetail.jsx`) displays live driver marker on map with stale-location indicator (green pulsing when fresh, amber when >30s stale).

### ✅ Phase 8 — Passenger Location (COMPLETED)

Server broadcasts passenger location to `trip:{tripId}` room when passenger sends location without `rideId`. Passenger page (`SharedTripDetail.jsx`) emits periodic location when accepted/arriving. Driver page (`DriverActiveSharedTrip.jsx`) listens for `PASSENGER_LOCATION` and merges live coords into passenger markers, overriding planned pickup coords.

### ✅ Phase 9 — WebSocket Audit (COMPLETED)

Audited all 46 `socket.on()` + `socket.off()` pairs across 8 frontend page files — zero missing cleanup. Server fixes: `connection` handler body wrapped in try/catch to prevent unhandled rejections; `disconnect` handler now actually clears bid timers via `driverTimerMap` (new map tracking driver→timer[]); all 3 context providers verified correct.

### ✅ Phase 10 — Notification Synchronization (COMPLETED)

Created `server/utils/notify.js` helper (`notify` + `notifyMany`). Added notifications for `cancelTrip`, `leaveTrip`, `removePassenger`, `driverArriving`, `boardPassenger`, `dropoffPassenger`, `updateTripStatus`, and auto-complete.

### Phase 11 — Payment Implementation

Authorize on accept, capture on completion, refund on cancel. Support Stripe + wallet + cash.

### Phase 12 — Driver Cancellation

Handle cancellation from any status: refund passengers, restore seats, notify all.

### ✅ Phase 13 — Passenger Cancellation (DONE in Phase 6)

Implemented as `leaveTrip` endpoint with transaction locking and seat restoration.

### Phase 14 — Individual Passenger Completion

Per-passenger dropoff flow. Trip auto-completes when all passengers dropped off.

### Phase 15 — Offline Recovery

REST endpoint for full state restoration. localStorage caching for instant UI on reopen.

### Phase 16 — Concurrency & Transactions

Wrap all state changes in transactions. Add idempotency keys.

### Phase 17 — Database Integrity

Add cascade rules, indexes, CHECK constraints.

### Phase 18 — Code Quality

Extract service layer, create state machine module, standardize emit patterns.

### Phase 19 — Testing

Backend integration tests + frontend component tests for all scenarios.

---

## Files to Modify

| File | Phase |
|------|-------|
| `server/models/TripRequest.js` | 0 |
| `server/models/SharedTrip.js` | 0 |
| `server/models/Transaction.js` | 0 |
| `server/sockets/events.js` | 1 |
| `server/sockets/index.js` | 1, 2, 3, 7, 8, 9 |
| `server/controllers/sharedTripController.js` | 2, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14 |
| `server/controllers/paymentController.js` | 11 |
| `server/services/sharedTripService.js` | 18 |
| `server/routes/sharedTrips.js` | 4, 5, 6, 7, 8, 12, 13 |
| `server/routes/tripRequests.js` | 13, 14 |
| `client/src/constants/socketEvents.js` | 1 |
| `client/src/pages/DriverActiveSharedTrip.jsx` | 2, 3, 4, 5, 7, 14 |
| `client/src/pages/SharedTripDetail.jsx` | 2, 3, 4, 7, 8, 13 |
| `client/src/pages/PassengerHub.jsx` | 2, 5 |
| `client/src/pages/ActiveRide.jsx` | — |
| `client/src/context/SocketContext.jsx` | 3, 9 |
