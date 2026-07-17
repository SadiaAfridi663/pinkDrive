## Plan: New Features Implementation

### 1. Ride Sharing (Phase 10)
- Driver creates a SharedTrip (pickup→dropoff, date/time, seats, price/seat, cash/wallet)
- Route-corridor matching: when passenger requests a ride, check if any shared trip's route covers their pickup
- If match → show shared trip option; otherwise normal flow
- Real-time seat count via WebSocket
- Driver sees requests with Accept/Decline/View Profile
- Decline shows reason form
- Driver mode lock: exclusive — can't do shared trip + private ride simultaneously

### 2. Review System (Phase 11)
- Mutual reviews: passenger↔driver after ride completion
- Rating 1-5 + optional comment
- Average rating on driver profile

### 3. Notification Panel (Phase 12)
- Notification model + API + WebSocket push
- Zero polling — pure WebSocket-driven
- Slide-out panel from bell icon in header
- Unread badge count in real-time

### Current Bug
- when a passenger pays a driver it shows
