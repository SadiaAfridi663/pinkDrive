# PinkDrive — Full Project Summary

> Women-only ride booking web application (MERN stack + PostgreSQL)
> Last updated: June 8, 2026

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS v4 |
| Backend | Express.js, Node.js |
| Primary DB | PostgreSQL 16 (via Docker) — users, auth, payments, rides, driver verification |
| Secondary DB | MongoDB (via Mongoose) — geo-spatial, real-time ride tracking (setup but unused in dev) |
| ORM | Sequelize (PostgreSQL) |
| Auth | JWT (httpOnly cookies) |
| Real-time | Socket.io |
| Maps | Leaflet + OpenStreetMap tiles (free, no API key) |
| Routing | OSRM public API (`router.project-osrm.org`) |
| Geocoding | Nominatim (free, 1 req/sec limit) |
| Email | Nodemailer — Gmail SMTP (app password) or Ethereal fallback |
| Payments | Cash (active), Stripe (field in model, disabled in UI) |
| Uploads | Multer → local filesystem (`server/uploads/`) |
| Styling | Tailwind CSS v4 with `@theme` design tokens |

---

## Architecture

```
client/               # React frontend (Vite)
server/               # Express backend
  controllers/        # Route handler logic
  middleware/         # Auth, validation, error handling
  models/            # Sequelize models (PostgreSQL)
  routes/            # Express route definitions
  sockets/           # Socket.io event handlers
  config/            # DB config, env vars
  utils/             # Helper functions
tests/                # E2E smoke test script
```

### Ports
- Frontend: `:5173` (Vite dev)
- Backend: `:5000`
- PostgreSQL: `:5432` (Docker)

---

## Database Schema (PostgreSQL — Sequelize)

### Users table
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | STRING | Required |
| email | STRING | Unique, required |
| password | STRING | bcrypt hashed |
| phone | STRING | Required |
| role | ENUM | `passenger`, `driver`, `admin` |
| gender | ENUM | `female`, `male` (only `female` allowed via validation) |
| isDriverVerified | BOOLEAN | Default false |
| currentLat/Lng | FLOAT | Driver's real-time location |
| lastActiveAt | DATE | Driver's last location update |
| isEmailVerified | BOOLEAN | Default false |

### PendingRegistrations table
Pre-verification storage. Row deleted after successful email verification, then User row created.

### DriverDocuments table
| Field | Type | Notes |
|-------|------|-------|
| userId | UUID | FK to Users |
| documentType | ENUM | `license`, `registration`, `profile_photo` |
| filePath | STRING | Absolute path from Multer |
| status | ENUM | `pending`, `approved`, `rejected` |

### Rides table
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| passengerId | UUID | FK |
| driverId | UUID | FK (nullable until accepted) |
| pickupLat/Lng | FLOAT | |
| dropoffLat/Lng | FLOAT | |
| pickupAddress | TEXT | From Nominatim reverse geocode |
| dropoffAddress | TEXT | From Nominatim reverse geocode |
| selfiePath | STRING | Relative path (`uploads/...`) |
| distance | FLOAT | km, Haversine |
| fare | FLOAT | PKR (distance × 50) |
| paymentMethod | ENUM | `cash`, `stripe`, `card` |
| paymentStatus | ENUM | `pending`, `paid`, `failed`, `refunded` |
| status | ENUM | `pending` → `accepted` → `arrived` → `in_progress` → `completed` |
| driverLat/Lng | FLOAT | From socket location:update |
| passengerLat/Lng | FLOAT | From socket location:update |
| startedAt | DATE | When driver accepts |
| completedAt | DATE | When status becomes completed |
| cancelledAt | DATE | When passenger cancels |

---

## Authentication Flow

1. **Register**: Data saved to `pending_registrations` table; 4-digit OTP sent via email
2. **Verify**: OTP checked → row deleted from `pending_registrations` → `User` row created
3. **Login**: Email + password → JWT in httpOnly cookie
4. **Session**: `AuthContext` with `useReducer` — loads user from `/auth/me` on mount
5. **Logout**: Clears cookie, resets context state

### Email Setup
- `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Gmail app password)
- `from` address uses `SMTP_USER` (Gmail) to avoid delivery drops
- If SMTP is empty/misconfigured → Ethereal auto-created fallback account
- Ethereal preview URL shown prominently in console
- OTP always logged to console regardless of transport

---

## Phase-by-Phase Progress

### Phase 0 — Scaffolding
- Vite+React frontend, Express backend
- PostgreSQL via Docker (`docker compose up -d`)
- ESLint + Prettier config
- Winston logger
- Folder structure, `COMMANDS.md`

### Phase 1 — Auth
- User model with bcrypt, roles, gender=female validation
- JWT auth + role middleware guards
- Controller: register, login, getMe, logout, verifyEmail, resendVerification
- Pages: Register, Login, VerifyEmail
- AuthContext with useReducer
- ProtectedRoute component
- PendingRegistration pre-verification flow

### Phase 2 — Driver Verification
- DriverDocument model (PostgreSQL, Sequelize)
- Multer upload — image filter, UUID filenames
- Driver controller: upload, status, pending, approve, reject, delete
- Pages: DriverVerification, DriverDashboard, AdminVerification
- Admin dashboard shows pending docs, approve/reject actions

### Phase 3 — Ride Request System
- Ride model with full status flow
- Controller: create, accept, updateStatus, cancel, getHistory, getActiveRide, getRideById, getPendingRides, getNearbyDrivers
- Leaflet/OSM MapLocationPicker (single marker, draggable)
- SelfieCapture (camera, retake via getUserMedia)
- RequestRide wizard: pickup → dropoff → selfie → payment
- ActiveRide page with live polling + socket driver location
- DriverRides page with geolocation + socket emission
- All ride cards show addresses + distance + fare
- RideDetail page (`/ride/:id`) with route map

### Phase 3 Refinements
- Selfie required (not optional)
- Reverse geocoding via Nominatim (1.1s delay between calls for rate limit)
- Haversine distance calculated on ride creation
- Fare = distance × 50 PKR (configurable `FARE_PER_KM`)
- Profile photo included in all driver responses
- `fileToUrl()` utility converts absolute multer paths to relative URLs
- Upload filter accepts any image/*

### Phase 6 — SOS Emergency
- SOSAlert & EmergencyContact models (PostgreSQL)
- `sosController` for trigger, resolve, and contact management (max 5 per user)
- Real-time alerts via Socket.io `admin-room` broadcast
- Passenger SOS button on ActiveRide page with confirmation
- Admin SOS monitoring dashboard with real-time updates and contact info
- Passenger Emergency Contacts management page

### UI Redesign
- Editorial-pink aesthetic: plum, pink, gold, Fraunces (display) + DM Sans (body)
- Page/page-header layout pattern
- Auth pages: centered card layout
- Button system: .btn (primary/outline/danger/sm/large)
- Nav component with role-based links
- PassengerDashboard, DriverDashboard, AdminDashboard

### Real-time Stack (Socket.io)
- Server: `http.createServer(app)`, `Server(socket.io)`, JWT auth on handshake
- Rooms: `join:ride` / `leave:ride` for scoped broadcasts
- `location:update` → driver broadcasts `driver:location`, passenger broadcasts `passenger:location`
- Online driver tracking via in-memory `onlineDrivers` map
- Client: `SocketProvider` + `useSocket` hook — auto-connects when user+token exist
- DriverRides: `watchPosition()` + socket emit every 5s + immediate emit on effect
- ActiveRide: joins room, listens for `driver:location`, shares passenger location

### Location System
- `useGeolocation` hook — permissionState, request(), startWatching(), stopWatching()
- `LocationGate` wrapper — shows "Enable Location" button (prompt), persistent warning (denied), renders children (granted)
- Applied to RequestRide, ActiveRide, DriverRides
- Browser Geolocation API required; ride features blocked until permission granted

### Nearby Drivers
- `currentLat`/`currentLng`/`lastActiveAt` on User model
- `GET /rides/nearby-drivers?lat=&lng=&radius=` endpoint
- Filters online, verified, not-busy drivers within radius
- Shown as car emoji icons on RequestRide pickup map

### Map Components
- **RideRouteMap**: Reusable — green pickup, red dropoff, blue driver, orange passenger markers + OSRM polyline (pink) + nearby driver car icons + dual marker support + fitBounds
- **MapLocationPicker**: Single marker + optional `otherMarker` (green pickup icon in dropoff step)

### Tailwind CSS v4 Migration
- Installed `tailwindcss` + `@tailwindcss/vite`
- Vite plugin added
- `index.css`: `@import "tailwindcss"` + `@theme` block (18 colors, 2 fonts, 2 radii, 1 container)
- All 18 JSX files migrated from BEM classes to Tailwind utilities
- ~120 BEM classes → Tailwind, ~96 inline styles → utilities
- Deleted unused `App.css`
- `@layer base` for body defaults

---

## Bug Fix History

### Fix Round 1: Image URLs + Driver Location + Auto-arrived
| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Images not showing on cards | `req.file.path` returns absolute path; frontend can't resolve | Added `fileToUrl()` utility — strips absolute prefix, returns `uploads/...` relative path |
| Driver marker not on passenger map | `acceptRide` conditionally saved `driver.currentLat` (only if non-null); no socket emit on accept | Save driver location unconditionally; driver emits location immediately via socket after accept |
| Auto-arrived not working | No distance check in socket handler | Added ≤50m Haversine check in `location:update` socket handler; auto-transitions to `arrived` and emits `ride:status` |
| "Mark Arrived" always active | No distance display or disabled state | Shows real-time distance to pickup; button disabled when >50m away |

### Fix Round 2: Tailwind Migration
- Installed and configured Tailwind v4
- Migrated all components from BEM to Tailwind
- Fixed `App.css` removal
- Build + E2E passing

### Fix Round 3: 5 Map & Real-Time Bugs
| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Maps show Lahore default | `useGeolocation` never called `getCurrentPosition` when permission already granted | Auto-call `getCurrentPosition` on mount if `permissionState === 'granted'` |
| Map glitches after time | No `invalidateSize()` call; new object refs every render re-triggered route fetch | Added `ResizeObserver` in RideRouteMap; memoized pickup/dropoff in ActiveRide + DriverRides |
| Ride status not updating for passenger | `acceptRide`/`updateRideStatus` emitted no socket events; PassengerDashboard had no polling | Added `getIO()` export from sockets; emit `ride:status` in both controllers; PassengerDashboard gets 5s polling + socket listener |
| Driver marker not visible after accept | `acceptRide` conditionally saved driver location; no socket emit on accept | Unconditional driver location save; immediate geolocation emit after accept; `fitAll()` called in ALL marker effects |
| Images not showing on cards | Helmet `crossOriginResourcePolicy: 'same-origin'` blocks :5173→:5000 image loads | Changed to `crossOriginResourcePolicy: 'cross-origin'` |
| Hooks error in ActiveRide | `useMemo` after early `return` — violates Rules of Hooks | Moved all `useMemo` calls above early returns |

### Fix Round 4: Current Round
| Issue | Root Cause | Fix |
|-------|-----------|-----|
| No blue dot showing user location | `MapLocationPicker` had no user-location indicator | Added `userLocation` prop + pulsating `L.circleMarker` (blue, 8-12px radius pulse) |
| Map shows wrong location on dropoff step | `initialPosition={dropoff}` was null → map defaulted to Lahore | Changed to `initialPosition={dropoff \|\| pickup \|\| position}` |
| Route polyline invisible | `areCoordsEqual` guard may block re-fetch; OSRM errors silent | Removed `areCoordsEqual` guard; added `catch` logging |
| Pickup marker disappears on step change | New `MapLocationPicker` mounts from scratch; flash before `otherMarker` appears | `otherMarker` is already passed; fix centers map on pickup location so marker is visible immediately |

### Fix Round 5: Arrival Threshold & E2E Cleanup
| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Auto-arrival inconsistent | 50m threshold too tight for GPS drift | Updated threshold to 200m in server (socket) and client (DriverRides) |
| E2E Ride creation failing | Leftover ServiceArea data blocking pickup location | Added manual cleanup of `service_areas` table before E2E run |

---

## Key Design Decisions

1. **Dual database**: PostgreSQL for relational data (Sequelize), MongoDB for geo/real-time (Mongoose — inactive in dev)
2. **Pre-verification flow**: `pending_registrations` table; User created only after OTP verified
3. **Ethereal fallback**: Auto-created test account when SMTP unavailable
4. **Leaflet + OSM**: Free, no API key, works immediately
5. **Selfie stored in Ride model**: Uploaded via temp endpoint before ride creation
6. **Nominatim**: 1 req/sec limit with sequential calls + 1.1s delay
7. **Fare**: Simple `distance × 50 PKR/km`
8. **Cash active**: Stripe field exists but UI shows "Coming soon"
9. **Local uploads**: Files stored on `server/uploads/` filesystem (not cloud)
10. **Socket.io**: Chosen over polling for real-time location
11. **OSRM**: Client-side fetch, no server proxy
12. **Driver location**: Both in-memory (`onlineDrivers` map) + DB (`User.currentLat/Lng`, `Ride.driverLat/Lng`)
13. **Tailwind v4**: `@theme` block in CSS (no `tailwind.config.js`)
14. **Marker colors**: Green=pickup, Red=dropoff, Blue=driver, Orange=passenger, 🚗=nearby drivers

---

## Startup & Commands

```bash
# Start PostgreSQL
docker compose up -d

# Start backend only
npm run dev:server

# Start frontend only
npm run dev:client

# Start both
npm run dev

# Seed database (drops all tables, re-syncs)
npm run seed

# Run E2E tests (server must be running on :5000)
bash tests/e2e.sh

# Build frontend
npm run build --prefix client

# Lint
npm run lint

# Format
npm run format
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/server.js` | Express entry, Socket.io init, helmet, CORS, static `/uploads` |
| `server/sockets/index.js` | Socket handlers — auth, rooms, location, auto-arrived, getIO() |
| `server/models/Ride.js` | Ride model — status flow, location, payment fields |
| `server/models/User.js` | User model — roles, driver location fields |
| `server/controllers/rideController.js` | All ride CRUD + socket events + image URL conversion |
| `server/utils/geo.js` | `reverseGeocode`, `haversineDistance`, `fileToUrl` |
| `client/src/hooks/useGeolocation.js` | Geolocation hook — permission, request, watch |
| `client/src/components/MapLocationPicker.jsx` | Single-marker map picker + pulsating user dot + otherMarker |
| `client/src/components/RideRouteMap.jsx` | Multi-marker route map + OSRM polyline + fitBounds |
| `client/src/components/LocationGate.jsx` | Permission gate wrapper |
| `client/src/context/SocketContext.jsx` | Socket provider + useSocket hook |
| `client/src/pages/RequestRide.jsx` | 4-step wizard: pickup→dropoff→selfie→payment |
| `client/src/pages/ActiveRide.jsx` | Active ride view with live driver location |
| `client/src/pages/DriverRides.jsx` | Driver dashboard — accept, manage, geolocation emit |
| `client/src/pages/PassengerDashboard.jsx` | Hero CTA, active ride card, history |
| `client/src/pages/RideDetail.jsx` | `/ride/:id` — full ride details with map |
| `client/src/App.jsx` | Routes with SocketProvider |
| `client/src/index.css` | Tailwind v4 `@theme` design tokens |
| `tests/e2e.sh` | Full-cycle E2E smoke test |
| `server/models/ServiceArea.js` | Geo-fencing — polygon coordinates, name, active flag |
| `server/controllers/serviceAreaController.js` | CRUD for service areas (admin) |
| `server/routes/serviceAreas.js` | `/api/service-areas` routes |
| `client/src/pages/AdminGeoFence.jsx` | Admin page — click-to-draw polygon, list/activate/delete areas |
| `client/src/components/GeoFenceLayer.jsx` | Reusable Leaflet polygon overlay |
| `server/models/SOSAlert.js` | SOS alert schema (userId, rideId, lat/lng, status) |
| `server/models/EmergencyContact.js` | Emergency contact schema (userId, name, phone, relation) |
| `server/controllers/sosController.js` | SOS logic: trigger, resolve, contacts management |
| `server/routes/sos.js` | `/api/sos` routes |
| `client/src/pages/AdminSOS.jsx` | Admin SOS monitoring panel |
| `client/src/pages/EmergencyContacts.jsx` | Passenger emergency contact management |
---

## Environment Variables (.env)

```
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pinkdrive
DB_USER=pinkdrive_user
DB_PASS=pinkdrive_pass

# MongoDB (optional, unused in dev)
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Email (Gmail app password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
```

---

## Current Status

- ✅ Server starts, PostgreSQL connects, models sync
- ✅ Full auth flow (register → verify → login → session)
- ✅ Driver verification (upload docs → admin approve/reject)
- ✅ Ride lifecycle (request → accept → arrived → in_progress → completed)
- ✅ Real-time location tracking via Socket.io
- ✅ Selfie capture + upload
- ✅ Route maps with OSRM polylines
- ✅ Nearby drivers (online, verified, not-busy)
- ✅ Auto-arrived (driver ≤200m from pickup)
- ✅ Pulsating user-location blue dot
- ✅ Cross-origin image serving
- ✅ Hooks-safe conditional rendering
- ✅ Tailwind CSS v4 design system
- ✅ E2E smoke test passing (full cycle)
- ✅ Geo-Fencing (Phase 5) — ServiceArea model, point-in-polygon validation, admin CRUD, passenger map display
- ✅ SOS Emergency (Phase 6) — SOSAlert & EmergencyContact models, real-time admin alerts via Socket.io, passenger SOS button, emergency contact management

### Pending
- ~~Phase 5: Geo-Fencing~~ ✅ Done
- ~~Phase 6: SOS Emergency Feature~~ ✅ Done
- Phase 7: Stripe online payment integration
- Phase 8: Admin Dashboard — ride monitoring, user management, geo-fence editor, analytics
