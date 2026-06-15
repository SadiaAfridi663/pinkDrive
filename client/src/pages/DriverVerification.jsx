import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';

const DOC_TYPES = [
  { key: 'license', label: "Driver's License", accept: 'image/*' },
  { key: 'registration', label: 'Vehicle Registration', accept: 'image/*' },
  { key: 'profile_photo', label: 'Profile Photo', accept: 'image/*' },
];

function DriverVerification() {
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRefs = useRef({});
  const navigate = useNavigate();

  const handleFileSelect = (docType) => (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFiles((prev) => ({ ...prev, [docType]: file }));
    setPreviews((prev) => ({ ...prev, [docType]: URL.createObjectURL(file) }));
    setError('');
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
    const selected = Object.keys(files);
    if (selected.length === 0) {
      setError('Please upload at least one document.');
      return;
    }

    const formData = new FormData();
    for (const key of selected) {
      formData.append(key, files[key]);
    }

    setUploading(true);
    setError('');
    setMessage('');
    try {
      const res = await driverAPI.uploadDocuments(formData);
      setMessage(res.data.message);
      setTimeout(() => navigate('/driver/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Documents</h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">Upload verification documents (JPEG, PNG, or WebP, max 5MB each)</p>
      </div>

      {error && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{error}</p>}
      {message && <p className="bg-[#f1faf1] text-success border border-[#c8e6c9] px-3.5 py-2.5 rounded-sm text-sm mb-2">{message}</p>}

      <form onSubmit={handleSubmit}>
        {DOC_TYPES.map(({ key, label }) => (
          <div key={key} className="mb-3 mt-4">
            <label className="block text-sm font-medium text-plum mb-1.5">{label}</label>
            {previews[key] ? (
              <div className="relative inline-block">
                <img src={previews[key]} alt={label} className="block max-w-full h-auto max-h-[180px] rounded-sm border border-border" />
                <button type="button" className="absolute top-1 right-1 bg-black/60 text-white border-none rounded px-2 py-1 text-xs cursor-pointer hover:bg-black/80" onClick={() => removeFile(key)}>
                  Remove
                </button>
              </div>
            ) : (
              <div
                className="flex items-center justify-center p-6 border-2 border-dashed border-border rounded-sm cursor-pointer text-text-muted text-sm hover:border-pink hover:text-pink hover:bg-pink-subtle transition"
                onClick={() => fileInputRefs.current[key]?.click()}
              >
                <span>Click to upload {label.toLowerCase()}</span>
              </div>
            )}
            <input
              ref={(el) => (fileInputRefs.current[key] = el)}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect(key)}
            />
          </div>
        ))}

        {!uploading && (
          <button type="submit" className="btn-primary inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none px-8 py-3.5 text-base rounded w-full mt-6" disabled={uploading || Object.keys(files).length === 0}>
            {uploading ? 'Uploading...' : 'Submit for Verification'}
          </button>
        )}
      </form>

      {uploading && (
        <p className="mt-5 text-sm text-text-muted text-center mt-5">
          <button className="bg-none border-none text-pink cursor-pointer text-sm font-body font-medium p-0 underline hover:text-pink-dark" onClick={() => navigate('/driver/dashboard')}>
            Check verification status
          </button>
        </p>
      )}

    </div>
  );
}

export default DriverVerification;
