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
    <div className="flex items-center justify-center min-h-screen p-6 bg-gradient-to-br from-pink-subtle via-off-white to-pink-subtle">
      <div className="w-full max-w-[400px] bg-white border border-border rounded px-8 py-10">
        <h1 className="font-display text-[1.8rem] font-bold text-pink m-0 mb-1 tracking-[-0.02em]">PinkDrive</h1>
        <h2 className="font-body text-base font-normal text-text-muted m-0 mb-6">Welcome Back</h2>
        {(localError || error) && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{localError || error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            className="px-3 py-3 border-2 border-border rounded-sm font-body text-[0.95rem] outline-none transition bg-off-white text-text focus:border-pink focus:bg-white"
          />
          <button type="submit" className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none w-full mt-1" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="mt-5 text-sm text-text-muted text-center">
          Dont have an account? <Link to="/register" className="text-pink no-underline font-semibold hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
