# PinkDrive — Project Documentation

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | SPA UI framework |
| **Styling** | Tailwind CSS 4 | Utility-first CSS |
| **Maps** | Leaflet + react-leaflet | Interactive map rendering (replaced Google Maps) |
| **Icons** | Lucide React | SVG icon set |
| **HTTP Client** | Axios | API requests with interceptors |
| **Routing** | react-router-dom v7 | Client-side routing |
| **Backend** | Express.js 5 | REST API server |
| **Primary DB** | PostgreSQL + Sequelize 6 | Relational data (users, rides, wallets, payments, etc.) |
| **Secondary DB** | MongoDB + Mongoose | Geo-spatial data, real-time tracking (configured, partially used) |
| **Auth** | JWT (jsonwebtoken) | httpOnly cookies + Bearer header |
| **Passwords** | bcryptjs (12 rounds) | Password hashing |
| **Real-time** | Socket.io 4 | Ride tracking, bidding, notifications, shared trips |
| **Payments** | Stripe | Checkout sessions, PaymentIntents, webhooks |
| **Email** | Nodemailer | Verification codes, receipts, notifications |
| **File Uploads** | Multer | Driver docs, selfies, profile photos |
| **Validation** | express-validator | Request body validation |
| **Security** | Helmet, express-rate-limit | HTTP headers, rate limiting |
| **Logging** | Winston | Server-side structured logging |
| **Migrations** | Umzug | PostgreSQL schema migrations |
| **Build** | Vite 8 (client) + nodemon (server) | Dev tooling |

---

## Architecture Overview

```
Client (React + Vite)          Server (Express + Socket.io)          Databases
         │                              │                              │
         │── HTTP (Axios) ──────────────┤── Sequelize ────────────────┤── PostgreSQL
         │                              │                              │
         │                              │── Mongoose ──────────────────┤── MongoDB
         │                              │                              │
         │── WebSocket (Socket.io) ─────┤── Stripe API ────────────────┤── Stripe
         │                              │                              │
         │                              │── Nodemailer ────────────────┤── SMTP
         │                              │                              │
    ┌────┴────┐                   ┌─────┴─────┐
    │ Contexts │                   │ Middleware │
    │  Auth    │                   │  JWT Auth  │
    │  Socket  │                   │  Multer    │
    │  Notifs  │                   │  Rate Lim  │
    │  Toast   │                   │  Error     │
    └─────────┘                   └───────────┘
```

### Design Decisions
- **PostgreSQL for relational data**, MongoDB for geo-spatial: users, auth, payments, rides use PostgreSQL for ACID compliance and relational queries. MongoDB is configured for future geo-spatial queries (service areas, real-time tracking).
- **httpOnly cookies for JWT**: prevents XSS token theft; Bearer header fallback for non-browser clients.
- **Socket.io for real-time, REST for mutations**: sockets handle live streaming (location, bids, notifications); all state mutations go through REST endpoints.
- **Catch-async wrapper**: all controllers wrapped to avoid try/catch boilerplate.
- **Centralized error handler**: single Express error middleware returns `{ success: false, message }`.

---

## Topics & Features Used

### 1. Authentication & Authorization
- **Registration flow**: Register → verify email (code + token) → login
- **Driver special flow**: Register as driver → verify email → `finalizeDriver` (upload license, registration, profile photo) → admin reviews → `isDriverVerified`
- **JWT dual delivery**: httpOnly cookie + response body (for mobile/WebSocket)
- **Role-based access**: `authorize('passenger')`, `authorize('driver')`, `authorize('admin')`
- **Middleware chain**: `authenticate` (JWT verify + user load) → `authorize(roles)` (role check)
- **Session persistence**: `/api/auth/me` refreshes cookie + returns user on page load
- **Account suspension**: suspended users blocked at auth middleware level

### 2. Real-time Communication (Socket.io)
- **Authentication middleware**: JWT verified on socket handshake
- **Room system**: `user:{id}`, `driver:{id}`, `passenger:{id}`, `ride:{id}`, `trip:{id}`, `admin-room`
- **Bid system**: drivers submit bids → 10s TTL timer → auto-expiry on timeout → notify ride participants
- **Live location tracking**: driver sends location → broadcast to ride/trip room → auto-arrival detection (200m radius)
- **Online driver counter**: broadcast `drivers:online` count on connect/disconnect
- **Notification push**: any notification created → Socket.io event to recipient's room
- **SOS alerts**: emergency → real-time alert to all admins in `admin-room`
- **Shared trip events**: request, accept, decline, cancel, board, dropoff — all via socket events
- **Backfill on connect**: pending rides, active bids restored when user reconnects

### 3. Payment System (Stripe + Wallet)
- **Stripe Checkout Sessions**: fare-based payment links
- **Stripe Webhooks**: `checkout.session.completed` → confirm payment, update ride status
- **Webhook middleware ordering**: `express.raw()` MUST be before JSON parser for Stripe signature verification
- **Wallet system**: top-up, balance, pending transactions
- **Commission calculation**: 10% platform fee on each ride
- **Commission debt lock**: if `commissionDue >= 500`, driver cannot accept rides
- **Withdrawal requests**: driver requests payout → admin reviews → approves/rejects
- **Payment methods**: cash, stripe, card, easypaisa, jazzcash, wallet
- **Payment disputes**: passenger refuses payment → debt recorded → admin resolves

### 4. Ride Lifecycle
- **States**: `pending` → `accepted` → `arrived` → `in_progress` → `completed` / `cancelled`
- **Bidding system**: passenger posts ride → drivers bid (10s TTL) → passenger picks bid → ride accepted
- **Selfie verification**: passenger uploads selfie at pickup start as safety measure
- **Auto-arrival detection**: when driver within 200m of pickup, status auto-changes to `arrived`
- **Live tracking**: driver + passenger locations broadcast via socket during active ride
- **Payment confirmation**: driver confirms → passenger acknowledges → wallet/Stripe settled

### 5. Shared Trip System
- **Driver creates trip**: sets route, departure time, seat count, price/seat
- **Passenger requests join**: picks pickup/dropoff along route, number of seats
- **Driver manages requests**: accept/decline, see passenger profile
- **Boarding workflow**: driver arrives → passenger boards → en-route → dropped off
- **Status flow**: `active` → `full` → `in_progress` → `completed`
- **Per-passenger tracking**: `requestedSeats`, individual boarding/dropoff times

### 6. Maps & Location
- **Leaflet**: lightweight, free map library (no API key needed, unlike Google Maps)
- **react-leaflet**: React bindings for Leaflet
- **Haversine distance**: server-side distance calculation between coordinates
- **Service areas**: GeoJSON polygon boundaries in PostgreSQL (JSON field)
- **Location picker**: interactive map for pickup/dropoff selection on ride creation

### 7. File Uploads
- **Multer disk storage**: images stored in `uploads/driver-docs/`
- **File type restriction**: only images (JPEG, PNG, etc.), max 5MB
- **Random hex filenames**: prevents collisions and path traversal
- **Profile photos**: uploaded via `/api/auth/profile-photo`

### 8. Notifications
- **Dual delivery**: persisted to PostgreSQL (`notifications` table) + real-time via Socket.io
- **Typed notifications**: `type` field for categorization (verification, ride, payment, SOS, etc.)
- **Unread count**: separate endpoint for badge number
- **Bulk read**: `POST /read-all` marks all as read
- **Notification panel**: slide-out sidebar in DashboardLayout

### 9. SOS / Emergency
- **Trigger**: passenger taps SOS → alert created with lat/lng + ride context
- **Admin notification**: real-time `sos:alert` event to `admin-room`
- **Emergency contacts**: CRUD for passenger's emergency contacts
- **Alert resolution**: admin marks resolved with optional note

### 10. Driver Verification
- **Document types**: `license`, `registration`, `profile_photo`
- **Workflow**: upload → admin reviews → approve/reject each document
- **Status**: `not_submitted` → `pending` → `approved` / `rejected`
- **Re-upload**: rejected documents can be deleted and re-uploaded
- **Tab restriction**: unverified drivers see only Dashboard (with status card); rejected drivers also see Documents tab

### 11. Admin Dashboard
- **Stats**: aggregate counts for users, rides, revenue, disputes, SOS alerts
- **User management**: view, suspend, restrict (warning/suspended/banned)
- **Ride management**: view all rides, override payment status
- **Wallet management**: view driver wallets, adjust balance, settle commission
- **Dispute resolution**: review and resolve disputes between drivers and passengers
- **Withdrawal processing**: approve/reject driver payout requests
- **Activity log**: chronological event feed
- **Geo-fence management**: CRUD for service area polygons

### 12. Reviews & Ratings
- **Post-ride review**: rate driver 1-5 with optional comment
- **Driver rating aggregation**: average rating on public profile
- **Review associations**: tied to ride or trip request

### 13. Logging
- **Winston**: levels (info, warn, error, debug), file + console transports
- **Structured logs**: prefixes, JSON metadata, rotation via file size
- **Separate log files**: `logs/` directory

### 14. Security
- **Helmet**: secure HTTP headers (CSP, XSS, etc.)
- **Rate limiting**: auth endpoints, payment creation
- **Password hashing**: bcrypt with 12 salt rounds
- **JWT in httpOnly cookies**: XSS-resistant
- **Input validation**: express-validator on all mutation endpoints
- **SQL injection prevention**: Sequelize parameterized queries
- **File type restriction**: Multer file filter
- **Suspension check**: at auth middleware level, blocks all actions

### 15. Database Migrations
- **Umzug**: programmatic migration runner
- **Migration files**: sequential timestamp-prefixed files in `server/migrations/`
- **Seed script**: `node seed.js` for development data

---

## Problems, Edge Cases & Solutions

### Registration & Auth

| Problem | Edge Case | Solution |
|---|---|---|
| **Email already registered** | User tries to register with existing email | `findOne` check → 400 error before creating pending record |
| **Expired verification token** | User verifies after 24h | `expiresAt: { [Op.gt]: new Date() }` query filter → "Invalid or expired" error |
| **Driver submits documents without email verified** | User navigates directly to finalize-driver | `pending.emailVerified` check in `finalizeDriver` → 400 error |
| **Stale pending registration** | User re-registers with same email | `destroy({ where: { email } })` before creating new pending record |
| **Concurrent registration** | Same email submitted twice rapidly | Sequelize unique constraint on email catches the duplicate |
| **JWT token refresh on page reload** | Token might be stale or near expiry | `getMe` generates fresh token + sets new cookie on every call |
| **Socket auth on reconnect** | Socket.io reconnects with expired token | Auth middleware in `io.use` validates JWT; returns error if invalid |

### Rides & Bidding

| Problem | Edge Case | Solution |
|---|---|---|
| **Bid TTL race condition** | Driver bids as timer expires | Timer cleanup on disconnect; bid marked `expired` if TTL reached |
| **Driver accepts bid on cancelled ride** | Ride was cancelled while driver was viewing | Backend validates ride status before accepting bid |
| **Multiple drivers bid same amount** | Tie-breaking | First bid to arrive wins (REST call order + status check) |
| **Passenger selfie missing at pickup** | Passenger skips selfie upload | `selfiePath` nullable; ride still proceeds but logs warning |
| **Driver location during ride** | Location updates flood the server | Undelayed socket emission → throttled by nature (each event overwrites last location) |
| **Auto-arrival false positive** | Driver passes near pickup but isn't arriving | 200m threshold only triggers when driver is actively location-updating during an accepted ride |
| **Passenger cancels mid-bid** | Passenger cancels ride while drivers are bidding | `cancelled` status prevents further bid acceptance |
| **Driver accepts ride while on another** | Driver attempts concurrent rides | Socket handler checks driver's existing active ride before accepting |
| **Payment dispute double-claim** | Both parties claim payment | Debt model tracks single pending debt per ride; admin resolves |

### Shared Trips

| Problem | Edge Case | Solution |
|---|---|---|
| **Driver creates trip but not verified** | Unverified driver uses shared trip | Socket handler checks `isDriverVerified` before allowing trip creation |
| **Seat oversell** | Concurrent requests for last seat | `availableSeats` decremented atomically; validation before acceptance |
| **Passenger requests join to full trip** | Trip fills up between listing and request | Backend checks `availableSeats > 0` before creating request |
| **Driver cancels with accepted passengers** | Active passengers left stranded | Notification sent to all accepted passengers via socket + DB notification |
| **Passenger boards/dropoff race** | Driver taps board while passenger cancels | Status validation on each transition (cannot board a cancelled request) |
| **Driver arrives but passenger not ready** | Driver marked arriving but passenger delays | `driver_arriving` status lets passenger know; driver can proceed to next passenger |
| **Multiple passengers, same trip** | Complex state machine | Per-request status (`accepted` → `driver_arriving` → `passenger_boarded` → `in_progress` → `dropped_off`) |

### Payments & Wallet

| Problem | Edge Case | Solution |
|---|---|---|
| **Stripe webhook called multiple times** | Idempotency — Stripe sends duplicate events | Webhook handler checks `paymentStatus` before processing; idempotent by `stripeSessionId` |
| **Webhook body parsing conflict** | `express.raw()` needed for signature but conflicts with JSON parser | **Ordering fix**: `express.raw()` route-specific middleware before global `express.json()` |
| **Wallet balance goes negative** | Concurrent withdrawals or commission charges | `DECIMAL(10,2)` with application-level validation (`balance >= amount`) |
| **Commission debt accumulates** | Driver doesn't earn enough to cover commission | Debt lock at 500 PKR: `isDebtLocked()` blocks ride acceptance |
| **Stripe payment succeeds but server crashes** | Payment confirmed by Stripe but app didn't record it | Webhook retries; `checkout.session.completed` can be re-processed |
| **Partial payment from passenger** | Passenger pays less than fare | Dispute raised; debt recorded for remaining amount |
| **Driver withdraws with pending commission** | Commission due not settled before withdrawal | `settleCommission` runs before withdrawal; withdrawable = balance - commissionDue |

### Real-time (Socket.io)

| Problem | Edge Case | Solution |
|---|---|---|
| **Socket disconnects mid-ride** | Network loss during active ride | Location backfill on reconnection; socket joins ride room again |
| **Multiple tabs open** | Same user emits duplicate events | Room-based, not socket-based — duplicate emits are idempotent on server |
| **Driver online count stale** | Server crash resets onlineDrivers map | Count recalculated on each new connection; stale entries handled by socket disconnect |
| **Bid timer not cleared on disconnect** | Memory leak from abandoned bid timers | `driverTimerMap` tracks timers per driver; all cleared in `disconnect` handler |
| **Notification delivered twice** | Socket + REST both deliver | Notifications persisted once; socket is push, REST is for initial load/polling |
| **Socket auth handshake race** | Token not yet available when socket connects | Client socket connects after AuthContext confirms token; `socket.handshake.auth.token` set at connect time |

### Driver Verification

| Problem | Edge Case | Solution |
|---|---|---|
| **Unverified driver sees all tabs** | Driver in `pending` state can access rides, earnings | **Tab restriction**: only Dashboard tab shown when `not_submitted` or `pending`; Dashboard + Documents shown when `rejected` |
| **Re-upload after rejection** | Driver's old rejected documents still visible | `deleteRejectedDocument` endpoint to remove rejected docs; `isDriverVerified` reset to false |
| **Admin approves some docs but not all** | Partial approval leaves user in limbo | `reviewVerification` only sets `isDriverVerified = true` when ALL docs are `approved` |
| **Driver uploads duplicate documents** | Same doc uploaded twice | No dedup — each upload creates new `DriverDocument` row; admin reviews each |
| **Admin reviews pending docs after approval** | Driver already verified, more docs uploaded | Blocked by `isDriverVerified` check in `uploadDocuments` → "already verified" |

### UI/UX

| Problem | Edge Case | Solution |
|---|---|---|
| **Wallet button flicker on navigation** | Socket state updates after unmount | **mountedRef guard**: socket handlers check `mounted.current` before `setState` |
| **Wallet route 403** | Passenger accessing wallet endpoint that requires driver role | Removed `requireVerification` guard from `/wallet` route |
| **Map re-render loop** | Location updates trigger infinite re-renders | Memoized map component; Leaflet handles its own viewport updates |
| **Image load fails on profile** | User photo URL is broken | `onError` fallback → hide img, show initials instead |
| **Loading state flash** | Brief loading state on every navigation | Skeleton placeholders matching content shape (animate-pulse) |
| **Form validation UX** | User submits with invalid data | Field-level error messages from `express-validator` errors mapped to form fields |
| **Toast notification stacking** | Multiple toasts appear simultaneously | ToastContext handles queue with auto-dismiss per toast |

### Data Integrity

| Problem | Edge Case | Solution |
|---|---|---|
| **UUID collision** | Two records get same primary key | PostgreSQL `UUIDV4` — collision probability negligible |
| **Cascading deletes** | Deleting user should clean up related data | Sequelize `onDelete: 'CASCADE'` on foreign keys where appropriate; otherwise `SET NULL` |
| **Race condition on wallet update** | Two concurrent transactions modify balance | Sequelize optimistic locking via `transaction` parameter; all wallet operations pass transaction |
| **Polymorphic references** | Transaction references a ride OR a trip request | `referenceId` + `referenceType` string fields (not a proper FK) |
| **Stale driver docs after profile photo change** | Driver updates profile but old photo persists | Profile photo URL stored on User model independently; document records are historical |

### Performance & Infrastructure

| Problem | Edge Case | Solution |
|---|---|---|
| **N+1 queries on driver listing** | Admin fetches drivers, each with documents | `Promise.all` with per-driver query; could be optimized with eager loading |
| **File upload size** | User uploads 50MB image | Multer `limits.fileSize` = 5MB; reject with 400 |
| **Unused package weight** | `@google-cloud/vision` (117MB) in dependencies | Removed during Identity Verification rollback |
| **MongoDB connection failure** | MongoDB not running | Connection is lazy/optional; server starts without it |

---

## Key Architectural Patterns

### Error Handling
```
catchAsync wraps async controller → throws AppError → errorMiddleware catches → JSON response
```
- `AppError`: custom class with `statusCode`, `message`, `isOperational`
- `errorMiddleware`: logs via Winston, returns `{ success: false, message }`, stack in dev

### Response Format
All API responses follow:
```json
{
  "success": true/false,
  "data": { ... },
  "message": "Human-readable message"
}
```

### Socket Event Flow
```
Client emits → Server validates → Server processes → Server emits to room(s) → Client handlers
```
- Client never trusts socket data for state mutations (REST is source of truth)
- Socket events are lightweight signals; all CRUD via REST

### Middleware Chain
```
Route handler → validators → authenticate → authorize → controller → response
                 ↓ error
            AppError → errorMiddleware
```

### File Upload Flow
```
Client sends FormData → Multer parses → file saved to disk → file path stored in DB → URL returned
```
- Files stored in `uploads/{entity-type}/` with random hex names
- `fileToUrl()` utility converts file system path to accessible URL
