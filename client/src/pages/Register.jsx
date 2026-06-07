import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'passenger' });
  const [localError, setLocalError] = useState('');
  const [registered, setRegistered] = useState(false);
  const { register, loading, error, clearError } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) clearError();
    if (localError) setLocalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (form.password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }

    try {
      await register({ ...form, gender: 'female' });
      setRegistered(true);
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gradient-to-br from-pink-subtle via-off-white to-pink-subtle">
      <div className="w-full max-w-[400px] bg-white border border-border rounded px-8 py-10">
        <h1 className="font-display text-[1.8rem] font-bold text-pink m-0 mb-1 tracking-[-0.02em]">PinkDrive</h1>
        <h2 className="font-body text-base font-normal text-text-muted m-0 mb-6">Create Account</h2>

        {(localError || error) && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{localError || error}</p>}

        {registered && (
          <div className="text-center py-2">
            <p className="font-display text-[1.3rem] font-semibold text-success mb-2">Account created!</p>
            <p className="text-sm text-text-muted mb-4">
              Check your email for a <strong>4-digit verification code</strong> and enter it on the verify page.
            </p>
            <p className="bg-[#fff8e1] text-[#856404] border border-[#ffeeba] rounded-sm px-3 py-2.5 text-xs mb-4">
              Not seeing it? The code also appears in the <strong>server terminal</strong>.
            </p>
            <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" onClick={() => navigate(`/verify-email?email=${encodeURIComponent(form.email)}`)}>
              Go to Verify Page
            </button>
          </div>
        )}

        {!registered && (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                name="name"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                required
                className="px-3 py-3 border-2 border-border rounded-sm font-body text-[0.95rem] outline-none transition bg-off-white text-text focus:border-pink focus:bg-white"
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
                className="px-3 py-3 border-2 border-border rounded-sm font-body text-[0.95rem] outline-none transition bg-off-white text-text focus:border-pink focus:bg-white"
              />
              <input
                name="password"
                type="password"
                placeholder="Password (min 8 characters)"
                value={form.password}
                onChange={handleChange}
                required
                className="px-3 py-3 border-2 border-border rounded-sm font-body text-[0.95rem] outline-none transition bg-off-white text-text focus:border-pink focus:bg-white"
              />
              <input
                name="phone"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={handleChange}
                className="px-3 py-3 border-2 border-border rounded-sm font-body text-[0.95rem] outline-none transition bg-off-white text-text focus:border-pink focus:bg-white"
              />
              <div className="my-1">
                <label className="block text-xs text-text-muted mb-2">I want to join as</label>
                <div className="flex gap-2">
                  <label className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm cursor-pointer transition text-sm ${
                    form.role === 'passenger'
                      ? 'border-pink bg-pink-subtle text-pink font-semibold'
                      : 'border-border text-text bg-off-white hover:border-pink'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="passenger"
                      checked={form.role === 'passenger'}
                      onChange={handleChange}
                      className="hidden"
                    />
                    <span className="text-[1.4rem]">&#128694;</span>
                    <span>Passenger</span>
                  </label>
                  <label className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm cursor-pointer transition text-sm ${
                    form.role === 'driver'
                      ? 'border-pink bg-pink-subtle text-pink font-semibold'
                      : 'border-border text-text bg-off-white hover:border-pink'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="driver"
                      checked={form.role === 'driver'}
                      onChange={handleChange}
                      className="hidden"
                    />
                    <span className="text-[1.4rem]">&#128663;</span>
                    <span>Driver</span>
                  </label>
                </div>
              </div>
              {form.role === 'driver' && (
                <p className="text-xs text-text-muted italic m-0">
                  You will need to upload verification documents (license, vehicle registration, photo) after registration.
                </p>
              )}
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none px-8 py-3.5 text-base rounded w-full mt-1" disabled={loading}>
                {loading ? 'Creating account...' : `Register as ${form.role === 'driver' ? 'Driver' : 'Passenger'}`}
              </button>
            </form>
            <p className="mt-5 text-sm text-text-muted text-center">
              Already have an account? <Link to="/login" className="text-pink no-underline font-semibold hover:underline">Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Register;
