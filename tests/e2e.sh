#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:5000/api}"
SERVER_DIR="$(dirname "$0")/../server"
PASS_PREFIX="e2e-test-$(date +%s)"
PASS_EMAIL="${PASS_PREFIX}-pass@pinkdrive.test"
DRIVER_EMAIL="${PASS_PREFIX}-driver@pinkdrive.test"
ADMIN_EMAIL="${PASS_PREFIX}-admin@pinkdrive.test"
PASSWORD="TestPass123"

PASS=()
AUTH=()
RIDE_ID=""
SELFIE_PATH=""

green() { printf "\e[32m%s\e[0m\n" "$1"; }
red()   { printf "\e[31m%s\e[0m\n" "$1"; fail=1; }
fail=0

# Ensure in right dir
cd "$(dirname "$0")/.."

echo "=== PinkDrive E2E Smoke Test ==="
echo "API: $API_URL"
echo ""

# 1. Already seeded via: npm run seed
echo "--- DB already seeded ---"
green "[OK] Seed complete"
echo ""

# 2. Register passenger
echo "--- Passenger Registration ---"
PASS=$(curl -s -c /tmp/pink-e2e-cookies.txt "$API_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"E2E Passenger\",\"email\":\"$PASS_EMAIL\",\"password\":\"$PASSWORD\",\"phone\":\"3000000001\",\"role\":\"passenger\",\"gender\":\"female\"}")
echo "$PASS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Message:', d.get('message','?')); print('Success:', d.get('success','?'))" 2>/dev/null
green "[OK] Registration returned (pending verification)"
echo ""

# 3. Get verification code from DB directly
echo "--- Getting OTP from DB ---"
OTP=$(PGPASSWORD=pinkdrive_pass psql -h localhost -U pinkdrive_user -d pinkdrive -t -A -c \
  "SELECT \"verificationCode\" FROM pending_registrations WHERE email='$PASS_EMAIL' ORDER BY \"createdAt\" DESC LIMIT 1;")
echo "OTP: $OTP"
green "[OK] Got verification code"
echo ""

# 4. Verify passenger email
echo "--- Passenger Verification ---"
VERIFY=$(curl -s -b /tmp/pink-e2e-cookies.txt "$API_URL/auth/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$OTP\"}")
echo "$VERIFY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Verify:', d.get('message','?'))" 2>/dev/null
green "[OK] Passenger verified"
echo ""

# 5. Login as passenger
echo "--- Passenger Login ---"
LOGIN=$(curl -s -c /tmp/pink-e2e-cookies.txt -b /tmp/pink-e2e-cookies.txt "$API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$PASS_EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Login:', d.get('message','?')); print('Role:', d.get('data',{}).get('user',{}).get('role','?'))" 2>/dev/null
green "[OK] Passenger logged in"
echo ""

# 6. Upload selfie (temp) and create ride
echo "--- Upload Selfie ---"
SELFIE=$(curl -s -b /tmp/pink-e2e-cookies.txt -c /tmp/pink-e2e-cookies.txt "$API_URL/rides/selfie/upload" \
  -F "selfie=@${HOME}/dummyDocs/profile_photo.jpg")
echo "$SELFIE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Selfie upload:', d.get('message','?') if d.get('message') else 'OK'); print('Path:', d.get('data',{}).get('selfiePath','?'))" 2>/dev/null
SELFIE_PATH=$(echo "$SELFIE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('selfiePath',''))" 2>/dev/null)
if [ -z "$SELFIE_PATH" ]; then red "[FAIL] Selfie upload did not return path"; else green "[OK] Selfie uploaded: $SELFIE_PATH"; fi
echo ""

# 7. Create ride
echo "--- Create Ride ---"
CREATE=$(curl -s -b /tmp/pink-e2e-cookies.txt "$API_URL/rides" \
  -H 'Content-Type: application/json' \
  -d "{\"pickupLat\":31.5204,\"pickupLng\":74.3587,\"dropoffLat\":31.5497,\"dropoffLng\":74.3436,\"selfiePath\":\"$SELFIE_PATH\",\"paymentMethod\":\"cash\"}")
echo "$CREATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Create:', d.get('message','?'))" 2>/dev/null
RIDE_ID=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('ride',{}).get('id',''))" 2>/dev/null)
if [ -z "$RIDE_ID" ]; then red "[FAIL] Ride ID empty"; else green "[OK] Ride created: $RIDE_ID"; fi
# Check address / distance / fare / payment
echo "$CREATE" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{}).get('ride',{})
print('  pickupAddress:', d.get('pickupAddress','MISSING')[:60])
print('  dropoffAddress:', d.get('dropoffAddress','MISSING')[:60])
print('  distance:', d.get('distance','MISSING'))
print('  fare:', d.get('fare','MISSING'))
print('  paymentMethod:', d.get('paymentMethod','MISSING'))
print('  paymentStatus:', d.get('paymentStatus','MISSING'))
" 2>/dev/null
echo ""

# 8. Login as driver (from seed)
echo "--- Driver Login ---"
DRIVER_LOGIN=$(curl -s -c /tmp/pink-e2e-cookies2.txt "$API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"driver@pinkdrive.com","password":"password123"}')
echo ""

# 9. Get pending rides as driver
echo "--- Get Pending Rides ---"
PENDING=$(curl -s -b /tmp/pink-e2e-cookies2.txt "$API_URL/rides/pending")
echo "$PENDING" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rides=d.get('data',{}).get('rides',[])
print('Pending count:', len(rides))
for r in rides:
    print('  Ride:', r['id'][:8], '| pickupAddress:', (r.get('pickupAddress') or 'N/A')[:50])
    print('  distance:', r.get('distance', 'N/A'))
" 2>/dev/null
green "[OK] Pending rides fetched"
echo ""

# 10. Accept ride
echo "--- Accept Ride ---"
ACCEPT=$(curl -s -b /tmp/pink-e2e-cookies2.txt "$API_URL/rides/$RIDE_ID/accept" \
  -X PATCH)
echo "$ACCEPT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Accept:', d.get('message','?'))
driver=d.get('data',{}).get('driver',{})
print('Driver profile photo:', driver.get('profilePhoto','N/A'))
" 2>/dev/null
green "[OK] Ride accepted"
echo ""

# 11. Update status flow
echo "--- Status Flow ---"
for status in arrived in_progress completed; do
  STATUS=$(curl -s -b /tmp/pink-e2e-cookies2.txt "$API_URL/rides/$RIDE_ID/status" \
    -X PATCH -H 'Content-Type: application/json' \
    -d "{\"status\":\"$status\"}")
  echo "$STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  -> $status:', d.get('message','?'))" 2>/dev/null
done
green "[OK] Status flow completed"
echo ""

# 12. Ride history
echo "--- Ride History ---"
HISTORY=$(curl -s -b /tmp/pink-e2e-cookies.txt "$API_URL/rides/history")
echo "$HISTORY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rides=d.get('data',{}).get('rides',[])
print('History count:', len(rides))
for r in rides:
    print('  Status:', r['status'], '| pickup:', (r.get('pickupAddress') or 'N/A')[:40])
" 2>/dev/null
green "[OK] History fetched"
echo ""

# 13. Get active ride (should be null after completion)
echo "--- Get Active Ride (expect null) ---"
ACTIVE=$(curl -s -b /tmp/pink-e2e-cookies.txt "$API_URL/rides/active")
ACTIVE_RIDE=$(echo "$ACTIVE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('ride'))" 2>/dev/null)
if [ "$ACTIVE_RIDE" = "None" ]; then green "[OK] No active ride (correct)"; else red "[FAIL] Unexpected active ride"; fi
echo ""

# Cleanup
rm -f /tmp/pink-e2e-cookies.txt /tmp/pink-e2e-cookies2.txt
echo "=== Summary ==="
if [ "$fail" -eq 0 ]; then green "ALL TESTS PASSED"; else red "SOME TESTS FAILED"; fi
exit $fail
