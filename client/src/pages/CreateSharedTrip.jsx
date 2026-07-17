import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { sharedTripAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import MapLocationPicker from '../components/MapLocationPicker';
import AddressLabel from '../components/AddressLabel';
import useGeolocation from '../hooks/useGeolocation';
import { ToastContext } from '../context/ToastContext';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

function CreateSharedTrip() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const toast = useContext(ToastContext);

  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [availableSeats, setAvailableSeats] = useState(3);
  const [pricePerSeat, setPricePerSeat] = useState(50);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [activeSharedTrip, setActiveSharedTrip] = useState(null);
  const geo = useGeolocation();

  useEffect(() => {
    sharedTripAPI.getMyTrips().then(res => {
      const trips = res.data.data.trips || [];
      const active = trips.find(t => ['active', 'full', 'in_progress'].includes(t.status));
      setActiveSharedTrip(active || null);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!pickup || !dropoff || !departureDate || !departureTime) return;
    setSubmitting(true);
    try {
      const departureDateTime = new Date(`${departureDate}T${departureTime}`);
      await sharedTripAPI.create({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        departureTime: departureDateTime.toISOString(),
        availableSeats,
        pricePerSeat,
        paymentMethod,
      });
      toast?.show?.('Shared trip created! Passengers will be notified along your route.', 'success');
      navigate('/driver/dashboard');
    } catch (err) {
      toast?.show?.(err.response?.data?.message || 'Failed to create trip.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-5 lg:p-8">
      <div className="bg-white rounded-2xl border border-[#F0E0E8] shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#FFF8FA] text-[#8B8B9E] hover:text-[#1A1A1A] transition cursor-pointer border-none bg-transparent"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="text-xl font-bold text-[#880E4F] m-0">Create Shared Trip</h2>
              <p className="text-sm text-[#8B8B9E] m-0">Offer seats along your route</p>
            </div>
          </div>

          {activeSharedTrip && (
            <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
              <p className="text-sm text-amber-800 m-0">
                You have a shared trip in progress —
                <button onClick={() => navigate(`/driver/shared-trip/${activeSharedTrip.id}`)} className="font-bold text-amber-900 underline ml-1 bg-transparent border-none cursor-pointer">Manage Trip</button>
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${step >= s ? 'bg-[#E91E8C] text-white' : 'bg-[#F0E0E8] text-[#8B8B9E]'}`}>{s}</div>
                <div className={`h-0.5 flex-1 transition ${step > s ? 'bg-[#E91E8C]' : 'bg-[#F0E0E8]'}`} />
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Pickup Location</label>
                <div className="h-64 rounded-xl overflow-hidden border border-[#F0E0E8]">
                  <MapLocationPicker
                    onSelect={(loc) => setPickup(loc)}
                    initialPosition={pickup ? [pickup.lat, pickup.lng] : undefined}
                    userLocation={geo.position}
                  />
                </div>
                {pickup && (
                  <p className="text-xs text-[#8B8B9E] mt-2">
                    <AddressLabel address={pickup.address} lat={pickup.lat} lng={pickup.lng} />
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Dropoff Location</label>
                <div className="h-64 rounded-xl overflow-hidden border border-[#F0E0E8]">
                  <MapLocationPicker
                    onSelect={(loc) => setDropoff(loc)}
                    initialPosition={dropoff ? [dropoff.lat, dropoff.lng] : pickup ? [pickup.lat, pickup.lng] : undefined}
                    userLocation={geo.position}
                  />
                </div>
                {dropoff && (
                  <p className="text-xs text-[#8B8B9E] mt-2">
                    <AddressLabel address={dropoff.address} lat={dropoff.lat} lng={dropoff.lng} />
                  </p>
                )}
              </div>

              <button
                className="w-full bg-[#E91E8C] text-white font-bold py-3.5 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none disabled:opacity-50"
                disabled={!pickup || !dropoff}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Departure Date</label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-xl border border-[#F0E0E8] text-sm focus:outline-none focus:border-[#E91E8C] focus:ring-1 focus:ring-[#E91E8C] bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Departure Time</label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#F0E0E8] text-sm focus:outline-none focus:border-[#E91E8C] focus:ring-1 focus:ring-[#E91E8C] bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Available Seats</label>
                <div className="flex gap-2">
                  {[3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAvailableSeats(n)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition cursor-pointer ${
                        availableSeats === n
                          ? 'bg-[#FCE4EC] border-[#E91E8C] text-[#E91E8C]'
                          : 'bg-white border-[#F0E0E8] text-[#8B8B9E] hover:border-[#E91E8C]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Price per Seat (PKR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B8B9E] font-bold">PKR</span>
                  <input
                    type="number"
                    value={pricePerSeat}
                    onChange={(e) => setPricePerSeat(Math.max(1, parseInt(e.target.value) || 0))}
                    min={1}
                    className="w-full pl-14 pr-4 py-3 rounded-xl border border-[#F0E0E8] text-sm focus:outline-none focus:border-[#E91E8C] focus:ring-1 focus:ring-[#E91E8C] bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Payment Method</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-[#FCE4EC] border-[#E91E8C] text-[#E91E8C]'
                        : 'bg-white border-[#F0E0E8] text-[#8B8B9E] hover:border-[#E91E8C]'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod('wallet')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition cursor-pointer ${
                      paymentMethod === 'wallet'
                        ? 'bg-[#FCE4EC] border-[#E91E8C] text-[#E91E8C]'
                        : 'bg-white border-[#F0E0E8] text-[#8B8B9E] hover:border-[#E91E8C]'
                    }`}
                  >
                    Wallet
                  </button>
                  <button
                    onClick={() => setPaymentMethod('stripe')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition cursor-pointer ${
                      paymentMethod === 'stripe'
                        ? 'bg-[#FCE4EC] border-[#E91E8C] text-[#E91E8C]'
                        : 'bg-white border-[#F0E0E8] text-[#8B8B9E] hover:border-[#E91E8C]'
                    }`}
                  >
                    Card
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 rounded-xl border-2 border-[#F0E0E8] text-[#880E4F] font-bold hover:border-[#E91E8C] transition cursor-pointer bg-white"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !departureDate || !departureTime}
                  className="flex-1 bg-[#E91E8C] text-white font-bold py-3.5 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {pickup && dropoff && (
        <div className="mt-4 bg-white rounded-xl border border-[#F0E0E8] p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#8B8B9E] uppercase tracking-wider mb-2">Route Summary</p>
          <p className="text-sm text-[#1A1A1A] m-0">
            <span className="text-[#E91E8C]">●</span> <AddressLabel address={pickup.address} lat={pickup.lat} lng={pickup.lng} />
          </p>
          <p className="text-sm text-[#1A1A1A] m-0 mt-1">
            <span className="text-[#1A1A1A]">●</span> <AddressLabel address={dropoff.address} lat={dropoff.lat} lng={dropoff.lng} />
          </p>
        </div>
      )}
    </div>
  );
}

export default CreateSharedTrip;
