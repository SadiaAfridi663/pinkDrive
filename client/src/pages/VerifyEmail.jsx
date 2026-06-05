import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');
  const [tokenInput, setTokenInput] = useState(urlToken || '');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (urlToken && !verifiedRef.current) {
      verifiedRef.current = true;
      setStatus('verifying');
      authAPI.verifyEmail(urlToken)
        .then((res) => {
          setStatus('success');
          setMessage(res.data.message || 'Email verified successfully!');
        })
        .catch((err) => {
          setStatus('error');
          setMessage(err.response?.data?.message || 'Verification failed. Try pasting the code manually.');
        });
    }
  }, [urlToken]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setStatus('verifying');
    try {
      const res = await authAPI.verifyEmail(tokenInput.trim());
      setStatus('success');
      setMessage(res.data.message || 'Email verified successfully!');
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Verification failed. The token may be expired.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card verify-card">
        <h1>PinkDrive</h1>
        <h2>Verify Email</h2>

        {import.meta.env.DEV && status === 'idle' && (
          <p className="verify-dev-note" style={{ marginBottom: '1rem' }}>
            DEV MODE: The code appears in the <strong>server terminal</strong> (no real email configured).
          </p>
        )}

        {status === 'verifying' && (
          <p className="verify-status pending">Verifying your email...</p>
        )}

        {status === 'success' && (
          <>
            <p className="verify-status success">{message}</p>
            <Link to="/login" className="verify-goto-login" style={{ textAlign: 'center', display: 'block', marginTop: '1.5rem' }}>
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="verify-status error">{message}</p>
            <button className="btn btn-primary" onClick={() => setStatus('idle')} style={{ marginTop: '1rem' }}>
              Try Again
            </button>
          </>
        )}

        {status === 'idle' && (
          <form onSubmit={handleVerify}>
            <p className="verify-subtitle" style={{ marginBottom: '1rem' }}>
              Enter the verification code sent to your email.
            </p>
            <input
              className="code-input"
              placeholder="Paste your verification code"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={!tokenInput.trim()}>
              Verify Email
            </button>
          </form>
        )}

        <p className="auth-link" style={{ marginTop: '1rem' }}>
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyEmail;
