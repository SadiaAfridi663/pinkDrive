import { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { authAPI } from '../services/api';

const DOC_TYPES = [
  { key: 'license', label: "Driver's License" },
  { key: 'registration', label: 'Vehicle Registration' },
  { key: 'profile_photo', label: 'Profile Photo' },
];

function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'passenger' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const { login } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const navigate = useNavigate();
  const otpRef = useRef(null);

  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const [uploading, setUploading] = useState(false);
  const [docError, setDocError] = useState('');
  const [resending, setResending] = useState(false);
  const fileInputRefs = useRef({});

  useEffect(() => {
    if (showOtpModal) {
      setTimeout(() => otpRef.current?.focus(), 100);
    }
  }, [showOtpModal]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleFileSelect = (docType) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFiles((prev) => ({ ...prev, [docType]: file }));
    setPreviews((prev) => ({ ...prev, [docType]: URL.createObjectURL(file) }));
    setDocError('');
  };

  const removeFile = (docType) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[docType];
      return next;
    });
    setPreviews((prev) => {
      const next = { ...prev };
      URL.revokeObjectURL(next[docType]);
      delete next[docType];
      return next;
    });
    if (fileInputRefs.current[docType]) {
      fileInputRefs.current[docType].value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.register({ ...form, gender: 'female' });
      if (res?.data?.verificationToken) {
        setVerificationToken(res.data.verificationToken);
      }
      showToast('Verification code sent to your email!', 'info');
      setShowOtpModal(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setVerifying(true);
    setError('');
    try {
      const res = await authAPI.verifyEmail(otp.trim());
      setShowOtpModal(false);
      setOtpVerified(true);
      if (form.role !== 'driver') {
        await login(form.email, form.password);
        showToast('Welcome to PinkDrive!', 'success');
        navigate('/');
      } else {
        showToast('Email verified! Now upload your documents.', 'success');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. The code may be expired.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await authAPI.resendVerification(form.email);
      if (res?.data?.verificationToken) {
        setVerificationToken(res.data.verificationToken);
      }
      showToast('Verification code resent!', 'info');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  const handleDocSubmit = async () => {
    const selected = Object.keys(files);
    if (selected.length === 0) {
      setDocError('Please upload at least one document.');
      return;
    }
    const formData = new FormData();
    formData.append('token', verificationToken);
    for (const key of selected) {
      formData.append(key, files[key]);
    }
    setUploading(true);
    setDocError('');
    try {
      await authAPI.finalizeDriver(formData);
      await login(form.email, form.password);
      showToast('Registration complete! Documents submitted for review.', 'success');
      navigate('/');
    } catch (err) {
      setDocError(err.response?.data?.message || 'Upload failed. You can do this later from the Documents page.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className={`flex items-center justify-center min-h-screen p-6 bg-ivory transition-all duration-300 ${showOtpModal ? 'blur-sm pointer-events-none' : ''}`}>
        <div className="w-full max-w-[380px]">
          <div className="text-center mb-8">
            <h1 className="font-display text-[1.7rem] font-bold text-plum m-0 tracking-[-0.01em]">PinkDrive</h1>
            <p className="font-body text-sm text-stone m-0 mt-1">Women-only ride booking</p>
          </div>
          <div className="card p-7">
            <h2 className="font-body text-base font-semibold text-plum m-0 mb-5">
              {otpVerified ? 'Upload Documents' : 'Create Account'}
            </h2>
            {error && <p className="msg msg-error">{error}</p>}

            {!otpVerified && (
              <>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required className="input" />
                  <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required className="input" />
                  <input name="password" type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={handleChange} required className="input" />
                  <input name="phone" placeholder="Phone (optional)" value={form.phone} onChange={handleChange} className="input" />
                  <div className="my-1">
                    <label className="block text-xs text-stone mb-2">I want to join as</label>
                    <div className="flex gap-2">
                      <label className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm cursor-pointer transition text-sm ${form.role === 'passenger' ? 'border-pink bg-pink-subtle text-pink font-semibold' : 'border-border text-charcoal bg-white hover:border-pink'}`}>
                        <input type="radio" name="role" value="passenger" checked={form.role === 'passenger'} onChange={handleChange} className="hidden" />
                        <span className="text-[1.4rem]">&#128694;</span>
                        <span>Passenger</span>
                      </label>
                      <label className={`flex-1 flex flex-col items-center gap-1 p-3 border-2 rounded-sm cursor-pointer transition text-sm ${form.role === 'driver' ? 'border-pink bg-pink-subtle text-pink font-semibold' : 'border-border text-charcoal bg-white hover:border-pink'}`}>
                        <input type="radio" name="role" value="driver" checked={form.role === 'driver'} onChange={handleChange} className="hidden" />
                        <span className="text-[1.4rem]">&#128663;</span>
                        <span>Driver</span>
                      </label>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-full mt-1" disabled={loading}>
                    {loading ? 'Creating account...' : `Register as ${form.role === 'driver' ? 'Driver' : 'Passenger'}`}
                  </button>
                </form>
                <p className="mt-5 text-sm text-stone text-center">
                  Already have an account? <Link to="/login" className="text-pink no-underline font-semibold hover:underline">Login</Link>
                </p>
              </>
            )}

            {otpVerified && form.role === 'driver' && (
              <div>
                <p className="text-xs text-text-muted mb-4">
                  Your email is verified! Now upload your documents to complete registration. Admin will review them shortly.
                </p>
                {docError && <p className="text-xs text-error bg-[#fff5f5] border border-[#ffcdd2] px-2.5 py-2 rounded-sm mb-2">{docError}</p>}
                {DOC_TYPES.map(({ key, label }) => (
                  <div key={key} className="mb-2">
                    <label className="block text-xs font-medium text-plum mb-1">{label}</label>
                    {previews[key] ? (
                      <div className="relative inline-block">
                        <img src={previews[key]} alt={label} className="block max-w-full h-auto max-h-[120px] rounded-sm border border-border" />
                        <button type="button" className="absolute top-1 right-1 bg-black/60 text-white border-none rounded px-2 py-0.5 text-[10px] cursor-pointer hover:bg-black/80" onClick={() => removeFile(key)}>Remove</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-4 border-2 border-dashed border-border rounded-sm cursor-pointer text-text-muted text-xs hover:border-pink hover:text-pink hover:bg-pink-subtle transition" onClick={() => fileInputRefs.current[key]?.click()}>
                        <span>Click to upload {label.toLowerCase()}</span>
                      </div>
                    )}
                    <input ref={(el) => (fileInputRefs.current[key] = el)} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect(key)} />
                  </div>
                ))}
                <button className="btn btn-primary btn-full mt-3 text-sm" onClick={handleDocSubmit} disabled={uploading || Object.keys(files).length === 0}>
                  {uploading ? 'Submitting...' : 'Submit & Continue'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showOtpModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded px-8 py-10 w-full max-w-[380px] shadow-xl">
            <h2 className="font-body text-base font-semibold text-plum m-0 mb-2">Verify Email</h2>
            <p className="text-xs text-text-muted mb-4">
              A 4-digit code was sent to <strong>{form.email}</strong>.
            </p>
            <p className="bg-[#fff8e1] text-[#856404] border border-[#ffeeba] rounded-sm px-3 py-2.5 text-xs mb-4">
              <strong>Tip:</strong> The code is also printed in the <strong>server terminal</strong>.
            </p>
            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-3">
              <input
                ref={otpRef}
                className="font-body font-mono tracking-[0.15em] text-center px-3 py-3 border-2 border-border rounded-sm text-[0.95rem] outline-none transition bg-off-white text-text focus:border-pink focus:bg-white"
                type="text"
                inputMode="numeric"
                maxLength={64}
                placeholder="e.g. 8108"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-full mt-1" disabled={verifying || !otp.trim()}>
                {verifying ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>
            <button className="bg-none border-none text-pink cursor-pointer text-xs font-body font-medium p-0 underline hover:text-pink-dark mt-3" onClick={handleResend} disabled={resending} type="button">
              {resending ? 'Resending...' : 'Resend verification code'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Register;
