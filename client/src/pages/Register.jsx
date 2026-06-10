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
    <div className="flex items-center justify-center min-h-screen p-6 bg-ivory">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <h1 className="font-display text-[1.7rem] font-bold text-navy m-0 tracking-[-0.01em]">PinkDrive</h1>
          <p className="font-body text-sm text-stone m-0 mt-1">Women-only ride booking</p>
        </div>
        <div className="card p-7">
          <h2 className="font-body text-base font-semibold text-navy m-0 mb-5">Create Account</h2>
          {(localError || error) && <p className="msg msg-error">{localError || error}</p>}

          {registered ? (
            <div className="text-center py-2">
              <p className="font-display text-[1.3rem] font-semibold text-success mb-2">Account created!</p>
              <p className="text-sm text-stone mb-4">
                Check your email for a <strong>4-digit verification code</strong> and enter it on the verify page.
              </p>
              <p className="bg-[#fff8e1] text-[#856404] border border-[#ffeeba] rounded-sm px-3 py-2.5 text-xs mb-4">
                Not seeing it? The code also appears in the <strong>server terminal</strong>.
              </p>
              <button className="btn btn-primary" onClick={() => navigate(`/verify-email?email=${encodeURIComponent(form.email)}`)}>
                Go to Verify Page
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required className="input" />
                <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required className="input" />
                <input name="password" type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={handleChange} required className="input" />
                <input name="phone" placeholder="Phone (optional)" value={form.phone} onChange={handleChange} className="input" />
                <div className="my-1">
                  <label className="block text-xs text-stone mb-2">I want to join as</label>
                  <div className="flex gap-2">
                    <label className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm cursor-pointer transition text-sm ${form.role === 'passenger' ? 'border-coral bg-coral-light text-coral font-semibold' : 'border-border text-charcoal bg-white hover:border-coral'}`}>
                      <input type="radio" name="role" value="passenger" checked={form.role === 'passenger'} onChange={handleChange} className="hidden" />
                      <span className="text-[1.4rem]">&#128694;</span>
                      <span>Passenger</span>
                    </label>
                    <label className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm cursor-pointer transition text-sm ${form.role === 'driver' ? 'border-coral bg-coral-light text-coral font-semibold' : 'border-border text-charcoal bg-white hover:border-coral'}`}>
                      <input type="radio" name="role" value="driver" checked={form.role === 'driver'} onChange={handleChange} className="hidden" />
                      <span className="text-[1.4rem]">&#128663;</span>
                      <span>Driver</span>
                    </label>
                  </div>
                </div>
                {form.role === 'driver' && (
                  <p className="text-xs text-stone italic m-0">
                    You will need to upload verification documents (license, vehicle registration, photo) after registration.
                  </p>
                )}
                <button type="submit" className="btn btn-primary btn-full mt-1" disabled={loading}>
                  {loading ? 'Creating account...' : `Register as ${form.role === 'driver' ? 'Driver' : 'Passenger'}`}
                </button>
              </form>
              <p className="mt-5 text-sm text-stone text-center">
                Already have an account? <Link to="/login" className="text-coral no-underline font-semibold hover:underline">Login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Register;
