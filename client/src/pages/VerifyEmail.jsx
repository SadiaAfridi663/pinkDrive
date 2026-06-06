import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');
  const email = searchParams.get('email') || '';
  const [tokenInput, setTokenInput] = useState(urlToken || '');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
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
      setMessage(err.response?.data?.message || 'Verification failed. The code may be expired.');
    }
  };

  const handleResend = async () => {
    if (!email) {
      setResendMsg('Enter your email first, then click Resend.');
      return;
    }
    setResending(true);
    setResendMsg('');
    try {
      const res = await authAPI.resendVerification(email);
      setResendMsg(res.data.message || 'Code resent!');
    } catch (err) {
      setResendMsg(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card verify-card">
        <h1>PinkDrive</h1>
        <h2>Verify Email</h2>

        <p className="verify-dev-note" style={{ marginBottom: '1rem' }}>
          A 4-digit verification code has been sent to your email.
          <br />
          <strong>Tip:</strong> The code is also printed in the <strong>server terminal</strong> if you don't see it in your inbox.
        </p>

        {status === 'verifying' && (
          <p className="verify-status pending">Verifying your email...</p>
        )}

        {status === 'success' && (
          <>
            <p className="verify-status success">{message}</p>
            <Link to="/login" className="btn btn-primary" style={{ textAlign: 'center', display: 'block', marginTop: '1.5rem', textDecoration: 'none' }}>
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="verify-status error">{message}</p>
            <button className="btn btn-primary" onClick={() => { setStatus('idle'); setTokenInput(''); }} style={{ marginTop: '1rem' }}>
              Try Again
            </button>
          </>
        )}

        {status === 'idle' && (
          <form onSubmit={handleVerify}>
            <p className="verify-subtitle" style={{ marginBottom: '1rem' }}>
              Enter the <strong>4-digit verification code</strong> sent to your email.
            </p>
            <input
              className="code-input"
              type="text"
              inputMode="numeric"
              maxLength={64}
              placeholder="e.g. 8108"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={!tokenInput.trim()}>
              Verify Email
            </button>
          </form>
        )}

        {status !== 'success' && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            {resendMsg && (
              <p style={{ fontSize: '0.85rem', color: resendMsg.includes('Failed') ? 'var(--error)' : 'var(--success)', margin: '0.5rem 0' }}>
                {resendMsg}
              </p>
            )}
            <button className="link-button" onClick={handleResend} disabled={resending}>
              {resending ? 'Resending...' : 'Resend verification code'}
            </button>
          </div>
        )}

        <p className="auth-link" style={{ marginTop: '1rem' }}>
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyEmail;
