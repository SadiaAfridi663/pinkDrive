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
    <div className="flex items-center justify-center min-h-screen p-6 bg-gradient-to-br from-pink-subtle via-off-white to-pink-subtle">
      <div className="w-full max-w-[400px] bg-white border border-border rounded px-8 py-10">
        <h1 className="font-display text-[1.8rem] font-bold text-pink m-0 mb-1 tracking-[-0.02em]">PinkDrive</h1>
        <h2 className="font-body text-base font-normal text-text-muted m-0 mb-6">Verify Email</h2>

        <p className="bg-[#fff8e1] text-[#856404] border border-[#ffeeba] rounded-sm px-3 py-2.5 text-xs mb-4">
          A 4-digit verification code has been sent to your email.
          <br />
          <strong>Tip:</strong> The code is also printed in the <strong>server terminal</strong> if you don't see it in your inbox.
        </p>

        {status === 'verifying' && (
          <p className="text-[0.95rem] my-4">Verifying your email...</p>
        )}

        {status === 'success' && (
          <>
            <p className="text-[0.95rem] my-4 text-success font-medium">{message}</p>
            <Link to="/login" className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-center block mt-6 no-underline">
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="text-[0.95rem] my-4 text-error font-medium">{message}</p>
            <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-4" onClick={() => { setStatus('idle'); setTokenInput(''); }}>
              Try Again
            </button>
          </>
        )}

        {status === 'idle' && (
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <p className="text-sm text-text-muted mb-4 mb-4">
              Enter the <strong>4-digit verification code</strong> sent to your email.
            </p>
            <input
              className="font-body font-mono tracking-[0.15em] text-center px-3 py-3 border-2 border-border rounded-sm font-body text-[0.95rem] outline-none transition bg-off-white text-text focus:border-pink focus:bg-white"
              type="text"
              inputMode="numeric"
              maxLength={64}
              placeholder="e.g. 8108"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              required
            />
            <button type="submit" className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none w-full mt-1" disabled={!tokenInput.trim()}>
              Verify Email
            </button>
          </form>
        )}

        {status !== 'success' && (
          <div className="mt-4 text-center">
            {resendMsg && (
              <p className="text-sm my-2" style={{ color: resendMsg.includes('Failed') ? '#d32f2f' : '#2e7d32' }}>
                {resendMsg}
              </p>
            )}
            <button className="bg-none border-none text-pink cursor-pointer text-sm font-body font-medium p-0 underline hover:text-pink-dark" onClick={handleResend} disabled={resending}>
              {resending ? 'Resending...' : 'Resend verification code'}
            </button>
          </div>
        )}

        <p className="mt-5 text-sm text-text-muted text-center mt-4">
          <Link to="/login" className="text-pink no-underline font-semibold hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyEmail;
