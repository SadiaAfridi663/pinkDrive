# Shared Ride UI, UX & Payment Flow — Implementation Plan

## Executive Summary

The audit revealed **4 critical bugs**, **8 high-severity issues**, and numerous UX gaps across the shared ride system. The plan is organized into 7 implementation phases, each building on the previous one.

---

## Critical Bugs Found

| ID | Severity | Description | File |
|----|----------|-------------|------|
| **C1** | Critical | `updateTripStatus('completed')` never calls `capturePayment` — driver never gets paid | `sharedTripController.js:787-793` |
| **C2** | Critical | `holdPayment`, `capturePayment`, `releasePayment` are all fire-and-forget (no `await`) | `sharedTripController.js:432,570,646,722,980` |
| **C3** | Critical | `SharedTrip.js` paymentMethod excludes `'stripe'` — Stripe path unreachable | `SharedTrip.js:56` |
| **C4** | Critical | `captureStripePayment` accesses `tripRequest.trip?.driverId` without eager-loading `trip` association | `sharedPaymentService.js:223` |

---

## Phase 1 — Fix Critical Payment Bugs

**Goal:** Make the payment system functional and reliable before any UI changes.

### 1a. Add `stripe` to SharedTrip paymentMethod validation
- **File:** `server/models/SharedTrip.js:56`
- Change: `isIn: [['cash', 'wallet', 'stripe']]`
- **Note:** The CreateSharedTrip form currently only offers cash/wallet toggles. Add Stripe option too.

### 1b. `await` all payment calls + propagate errors
- **File:** `server/controllers/sharedTripController.js`
- Change at lines 432, 570, 646, 722, 980: `holdPayment(request, trip)` → `await holdPayment(request, trip)`
- Wrap in try/catch and return proper error responses to the client.
- **Critical:** If `holdPayment` fails (e.g., Stripe API down, insufficient balance), the request acceptance should fail — not silently succeed.

### 1c. Fix `updateTripStatus('completed')` to capture payments
- **File:** `server/controllers/sharedTripController.js:780-793`
- Before setting all active requests to `completed`, iterate them and call `await capturePayment()` for each.
- This ensures the driver gets paid regardless of whether they use individual dropoff or "Complete Trip."

### 1d. Fix `captureStripePayment`
- **File:** `server/services/sharedPaymentService.js:212-235`
- Eager-load `trip` association before accessing `tripRequest.trip.driverId`.
- Create Transaction records for the audit trail.
- Add `commissionDue` tracking (match private ride behavior).

---

## Phase 2 — Map Infrastructure Refactor

**Goal:** Extract reusable marker components, eliminate duplication.

### 2a. Create `PassengerMapMarker` reusable component
- **New file:** `client/src/components/map/PassengerMapMarker.jsx`
- A factory function that creates an `L.divIcon` with:
  - 36px circular avatar with profile photo
  - Pink border (`#e9408b`, 3px)
  - Box shadow for visibility
  - Cache-busting via photo URL change detection
  - Initial-letter fallback when no photo
  - `photoUrl`, `name`, `size` props

### 2b. Create `DriverMapMarker` reusable component
- **New file:** `client/src/components/map/DriverMapMarker.jsx`
- Circular marker with driver profile photo, blue border (matching BLUE_ICON color)
- Current BLUE_ICON in RideRouteMap is just a colored pin — replace with actual driver photo

### 2c. Refactor RideRouteMap to use reusable markers
- **File:** `client/src/components/RideRouteMap.jsx`
- Extract `passengerMarkers` effect to use `PassengerMapMarker`
- Add `driverPhoto` prop — when provided, replace the blue pin with `DriverMapMarker` at driver location
- Remove duplicated icon definitions (AMBER_ICON inline creation, CAR_ICON, etc.)

---

## Phase 3 — Driver Map Flow (Marker Lifecycle)

**Goal:** Implement the pickup→dropoff marker transition for drivers.

### 3a. Driver location on shared trip map
- **File:** `client/src/pages/DriverActiveSharedTrip.jsx:293-300`
- Add `driverLocation` prop to RideRouteMap, sourced from the driver's own geolocation

### 3b. Passenger marker lifecycle state machine
- **File:** `client/src/pages/DriverActiveSharedTrip.jsx:242-251`
- Refactor `passengerMarkers` computation to:
  - **Before approval** (TripRequestsView): Show passenger photo at pickup — **hide dropoff** location
  - **After approval, before boarding**: Passenger photo at pickup location → use `passengerMarkers` at pickup coords
  - **After boarding**: Passenger photo moves to **dropoff** location → transition marker to dropoff coords
  - **After dropoff**: Remove passenger's marker entirely

### 3c. Filter dropped-off passengers from map
- **File:** `server/controllers/sharedTripController.js:1058` (getAcceptedPassengers)
- Exclude passengers with status `'dropped_off'` from the query
- **OR** | **File:** `client/src/pages/DriverActiveSharedTrip.jsx`
- Filter passengerMarkers to exclude those with `status: 'dropped_off'`

### 3d. Hide passenger dropoff before acceptance
- **File:** `client/src/pages/DriverHub.jsx:440` (TripRequestsView)
- Remove `secondaryDropoff` prop from RideRouteMap — driver should only see passenger pickup before accepting
- Remove `secondaryPickup` too if desired, since `passengerMarkers` already shows the passenger's pickup point
- Keep only: `pickup`, `dropoff`, `passengerMarkers` (showing photo at passenger's pickup)

### 3e. API: Include passenger status in getAcceptedPassengers
- **File:** `server/controllers/sharedTripController.js:1058`
- Return `status` field for each accepted passenger so the frontend can filter/transition markers

---

## Phase 4 — Passenger Map Experience

**Goal:** Make passenger maps show everything they need in real time.

### 4a. Add driver photo marker to passenger maps
- **File:** `client/src/pages/SharedTripDetail.jsx:347-354`
- Pass `driverPhoto={request.driverPhoto}` to RideRouteMap → map shows driver's photo at their live location
- Same for `PassengerHub.jsx:235-241`

### 4b. Add driver location + staleness to PassengerHub
- **File:** `client/src/pages/PassengerHub.jsx`
- Subscribe to `SERVER_EVENTS.DRIVER_LOCATION` in the active shared trip section
- Pass `driverLocation` to RideRouteMap
- Show staleness indicator

### 4c. Add vehicle info to shared trip APIs
- **File:** `server/controllers/sharedTripController.js` (getMyRequests, getAvailableTrips)
- Include vehicle fields from driver's profile: `vehicleModel`, `vehicleColor`, `licensePlate`
- Display on `SharedTripDetail.jsx`, `PassengerHub.jsx`, `RequestRide.jsx`

### 4d. Add ETA calculation for shared trips
- **File:** `server/sockets/index.js:162-173` (shared trip location handler)
- Compute `distanceToPickup` between driver and trip pickup point (same as private ride logic line 150)
- Emit `{ tripId, lat, lng, distanceToPickup, eta }` in the driver location event
- **File:** `client/src/pages/SharedTripDetail.jsx:332-345` — Display ETA text (e.g., "Driver is 5 min away")

### 4e. Remove duplicate marker presentation
- **File:** `client/src/pages/RequestRide.jsx:598-601`
- Replace `passengerMarkers` with `secondaryPickup`/`secondaryDropoff` for consistency with SharedTripDetail/PassengerHub
- OR: Add driver photo to the detail modal RideRouteMap

---

## Phase 5 — Wallet Validation & Payment Flow

**Goal:** Validate wallet before booking, fix wallet payment lifecycle.

### 5a. Frontend: Wallet validation before joining shared trip
- **File:** `client/src/pages/RequestRide.jsx:167-185`
- In `handleRequestJoin`:
  - Fetch wallet balance if trip's `paymentMethod === 'wallet'`
  - If `balance < pricePerSeat`: show error modal with "Insufficient Wallet Balance" message and "Add Money" button
  - "Add Money" navigates to `walletAPI.topup()` flow or `/passenger?tab=wallet`
- Also validate on the **available trip card** (lines 354-429) — show a warning badge if wallet insufficient

### 5b. Backend: `holdWalletPayment` should throw on insufficient balance
- **File:** `server/services/sharedPaymentService.js:68-99`
- Replace silent `logger.warn` + early return with `throw new AppError('Insufficient wallet balance.', 400)`
- This propagates to `acceptRequest` which can return a proper error to the driver

### 5c. Backend: Return `client_secret` for Stripe payments
- **File:** `server/controllers/sharedTripController.js:432`
- After `await holdPayment()`, if it's Stripe, include `clientSecret` in the response
- **File:** `client/src/services/api.js` — Add method to confirm the PaymentIntent on the frontend
- **File:** `client/src/pages/...` — Add the Stripe confirmation dialog after acceptance

### 5d. Wallet reservation flow
- **Status:** Current flow already holds ("reserves") funds on accept and captures on dropoff. The main fixes are:
  - Proper error propagation (5b)
  - Commission tracking in `captureWalletPayment` (add `commissionDue` tracking)
  - Transaction records for Stripe path

---

## Phase 6 — Cash Payment Confirmation

**Goal:** Add mutual cash confirmation for shared trips, matching private ride behavior.

### 6a. Add `awaiting_payment` status to TripRequest model
- **File:** `server/models/TripRequest.js:44-49`
- Add `'awaiting_payment'` and `'payment_dispute'` to the status validation

### 6b. Add cash confirmation endpoints for shared trips
- **File:** `server/controllers/sharedTripController.js`
- Add `confirmCashPayment(tripId, requestId)` — driver confirms receiving cash
  - Only driver of the trip can call
  - Request must have `paymentMethod: 'cash'` and `status: 'dropped_off'`
  - Sets `paymentStatus = 'paid'`, `isPaid = true`
  - Creates commission tracking (unlike current no-op for cash)
- Add `acknowledgeCashPayment(tripId, requestId)` — passenger confirms paying
  - Same logic as above but called by passenger
- **Both** should be required? Or either? Recommend: **either** can mark it paid (matching private ride behavior)

### 6c. Add cash confirmation UI for shared trips
- **File:** `client/src/pages/DriverActiveSharedTrip.jsx`
- After dropping off a passenger with `paymentMethod: 'cash'`, show a "Payment pending" status, then after trip completion show a "Has the passenger paid?" dialog with "Yes — Received" and "Report Issue" buttons
- **File:** `client/src/pages/SharedTripDetail.jsx`
- After being dropped off with `paymentMethod: 'cash'`, show "Did you pay the driver?" dialog with "Yes, I Paid" and "Report Issue" buttons
- **File:** `client/src/pages/PassengerHub.jsx`
- Show payment status for completed trips

### 6d. Handle mismatch (dispute)
- **File:** `server/controllers/sharedTripController.js`
- If passenger says "Paid" but driver says "Not Received": set `paymentStatus = 'disputed'`, create dispute record
- Reuse the existing dispute system (`server/controllers/disputeController.js` or admin flow)

---

## Phase 7 — Payment Status UI & Notifications

**Goal:** Make payment status visible everywhere.

### 7a. Payment status badges on shared trip pages
Status values to display:
- `pending` → "Payment Pending" (grey badge)
- `wallet_held` → "Wallet Reserved" (blue badge) — add this status to the flow
- `paid` → "Paid via Wallet" / "Cash Confirmed" / "Paid via Card" (green badge)
- `refunded` → "Refunded" (amber badge)
- `awaiting_payment` → "Cash Pending" (amber badge)
- `disputed` → "Payment Dispute" (red badge)

Files to update:
- `client/src/pages/SharedTripDetail.jsx` — Show badge next to price/payment info
- `client/src/pages/DriverActiveSharedTrip.jsx` — Show per-passenger payment status badge in passenger list
- `client/src/pages/PassengerHub.jsx` — Show status in shared trip cards and active trip section
- `client/src/pages/DriverHub.jsx` — Show in DashboardView active trip card

### 7b. Payment notification events
Add socket events for:
- `payment:held` — emitted when wallet/Stripe hold succeeds
- `payment:captured` — emitted when payment captures on dropoff
- `payment:released` — emitted on refund
- `payment:cash:confirmed` — emitted when cash payment confirmed
- `payment:disputed` — emitted when dispute created

Use `server/utils/notify.js` pattern for all, with Notifications table entries + socket emit.

### 7c. Transaction history for shared trips
- **File:** `client/src/pages/PassengerHub.jsx:504-547` (Wallet tab)
- Filter shared trip transactions with `referenceType: 'shared_trip'` or `tripRequestId`
- Show shared trip payments in the transaction list with proper descriptions

---

## Implementation Order

```
Phase 1 (Critical Bug Fixes)
   ↓
Phase 5 (Wallet Validation) — needed before Phase 6
   ↓
Phase 2 (Map Infrastructure) — needed before Phase 3/4
   ↓
Phase 3 (Driver Map Flow)
   ↓
Phase 4 (Passenger Map Experience)
   ↓
Phase 6 (Cash Payment Flow)
   ↓
Phase 7 (Payment Status UI & Notifications)
```

## Files to Create
- `client/src/components/map/PassengerMapMarker.jsx` (new)
- `client/src/components/map/DriverMapMarker.jsx` (new)

## Files to Modify

| File | Phases |
|------|--------|
| `server/models/SharedTrip.js` | 1a |
| `server/models/TripRequest.js` | 6a |
| `server/controllers/sharedTripController.js` | 1b, 1c, 3e, 4c, 5b, 6b |
| `server/services/sharedPaymentService.js` | 1d, 5b, 5d |
| `server/sockets/index.js` | 4d |
| `server/sockets/events.js` | 7b |
| `server/utils/notify.js` | 7b (if needed) |
| `client/src/components/RideRouteMap.jsx` | 2c, 3a |
| `client/src/components/MapLocationPicker.jsx` | — (already reviewed) |
| `client/src/pages/DriverActiveSharedTrip.jsx` | 1c (frontend), 3a, 3b, 3c, 6c, 7a |
| `client/src/pages/DriverHub.jsx` | 3d, 7a |
| `client/src/pages/SharedTripDetail.jsx` | 4a, 4d, 6c, 7a |
| `client/src/pages/PassengerHub.jsx` | 4b, 7a |
| `client/src/pages/RequestRide.jsx` | 4e, 5a |
| `client/src/pages/CreateSharedTrip.jsx` | 1a (add Stripe option) |
| `client/src/services/api.js` | 5c, 6b (new API methods) |
| `client/src/context/NotificationContext.jsx` | 7b (event handlers) |
| `client/src/constants/socketEvents.js` | 7b |
