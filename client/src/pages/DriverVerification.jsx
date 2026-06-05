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
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Documents</h1>
        <p className="page-subtitle">Upload verification documents (JPEG, PNG, or WebP, max 5MB each)</p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      <form onSubmit={handleSubmit}>
        {DOC_TYPES.map(({ key, label }) => (
          <div key={key} className="doc-upload" style={{ marginTop: '1rem' }}>
            <label className="doc-label">{label}</label>
            {previews[key] ? (
              <div className="doc-preview">
                <img src={previews[key]} alt={label} />
                <button type="button" className="doc-remove" onClick={() => removeFile(key)}>
                  Remove
                </button>
              </div>
            ) : (
              <div
                className="doc-dropzone"
                onClick={() => fileInputRefs.current[key]?.click()}
              >
                <span>Click to upload {label.toLowerCase()}</span>
              </div>
            )}
            <input
              ref={(el) => (fileInputRefs.current[key] = el)}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileSelect(key)}
            />
          </div>
        ))}

        <button type="submit" className="btn btn-primary btn-large" style={{ width: '100%', marginTop: '1.5rem' }} disabled={uploading || Object.keys(files).length === 0}>
          {uploading ? 'Uploading...' : 'Submit for Verification'}
        </button>
      </form>

      <p className="auth-link" style={{ marginTop: '1.25rem' }}>
        <button className="link-button" onClick={() => navigate('/driver/dashboard')}>
          Check verification status
        </button>
      </p>
    </div>
  );
}

export default DriverVerification;
