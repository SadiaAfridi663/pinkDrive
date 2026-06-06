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
    <div className="auth-page">
      <div className="auth-card">
        <h1>PinkDrive</h1>
        <h2>Create Account</h2>

        {(localError || error) && <p className="auth-error">{localError || error}</p>}

        {registered && (
          <div className="verify-banner">
            <p className="verify-title">Account created!</p>
            <p className="verify-subtitle">
              Check your email for a <strong>4-digit verification code</strong> and enter it on the verify page.
            </p>
            <p className="verify-dev-note">
              Not seeing it? The code also appears in the <strong>server terminal</strong>.
            </p>
            <button className="btn btn-primary" onClick={() => navigate(`/verify-email?email=${encodeURIComponent(form.email)}`)}>
              Go to Verify Page
            </button>
          </div>
        )}

        {!registered && (
          <>
            <form onSubmit={handleSubmit}>
              <input
                name="name"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                required
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
              />
              <input
                name="password"
                type="password"
                placeholder="Password (min 8 characters)"
                value={form.password}
                onChange={handleChange}
                required
              />
              <input
                name="phone"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={handleChange}
              />
              <div className="role-selector">
                <label className="role-label">I want to join as</label>
                <div className="role-options">
                  <label className={`role-option ${form.role === 'passenger' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="passenger"
                      checked={form.role === 'passenger'}
                      onChange={handleChange}
                    />
                    <span className="role-icon">&#128694;</span>
                    <span>Passenger</span>
                  </label>
                  <label className={`role-option ${form.role === 'driver' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="driver"
                      checked={form.role === 'driver'}
                      onChange={handleChange}
                    />
                    <span className="role-icon">&#128663;</span>
                    <span>Driver</span>
                  </label>
                </div>
              </div>
              {form.role === 'driver' && (
                <p className="role-note">
                  You will need to upload verification documents (license, vehicle registration, photo) after registration.
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
                {loading ? 'Creating account...' : `Register as ${form.role === 'driver' ? 'Driver' : 'Passenger'}`}
              </button>
            </form>
            <p className="auth-link">
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Register;
