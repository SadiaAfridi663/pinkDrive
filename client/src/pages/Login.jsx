import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');
  const { login, loading, error, clearError } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) clearError();
    if (localError) setLocalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Login failed');
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
          <h2 className="font-body text-base font-semibold text-navy m-0 mb-5">Welcome back</h2>
          {(localError || error) && <p className="msg msg-error">{localError || error}</p>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required className="input" />
            <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required className="input" />
            <button type="submit" className="btn btn-primary btn-full mt-1" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className="mt-5 text-sm text-stone text-center">
            Don't have an account?{' '}
            <Link to="/register" className="text-coral no-underline font-semibold hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
