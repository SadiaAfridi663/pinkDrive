import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

const getFileUrl = (filePath) => {
  if (!filePath) return '#';
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  return `${API_URL}/${normalized}`;
};

import { CheckCircle } from 'lucide-react';
import ImagePreviewModal from '../components/ImagePreviewModal';
import RejectionModal from '../components/RejectionModal';

function AdminVerification() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actioning, setActioning] = useState(null);
  const [rejectingUserId, setRejectingUserId] = useState(null);
  const [previewImages, setPreviewImages] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const navigate = useNavigate();

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getPendingVerifications();
      setDrivers(res.data.data.drivers);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending drivers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);



  const handleReview = async (userId, action, note) => {
    setActioning(userId);
    setError('');
    setMessage('');
    try {
      const res = await adminAPI.reviewVerification(userId, action, note || null);
      setMessage(res.data.message);
      setRejectingUserId(null);
      await fetchPending();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      setActioning(null);
    }
  };

  const badgeClass = (status) => {
    const base = 'inline-block text-xs font-semibold uppercase tracking-[0.05em] px-2 py-1 rounded';
    const colors = {
      approved: 'bg-[#e8f5e9] text-success',
      rejected: 'bg-[#ffebee] text-error',
      pending: 'bg-[#fff8e1] text-warning',
      accepted: 'bg-[#e3f2fd] text-[#1565c0]',
      arrived: 'bg-[#e3f2fd] text-[#1565c0]',
      in_progress: 'bg-[#f3e5f5] text-[#7b1fa2]',
      completed: 'bg-[#e8f5e9] text-success',
      cancelled: 'bg-[#f5f5f5] text-stone-light',
    };
    return `${base} ${colors[status] || colors.pending}`;
  };

  if (loading && drivers.length === 0) return <div className="flex items-center justify-center min-h-screen text-stone-light text-sm">Loading...</div>;

  return (
    <div className="page-wide">
      <div className="page-header page-header-accent">
        <h1>Verifications</h1>
        <p>Review driver document submissions</p>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {message && <p className="msg msg-success">{message}</p>}

      {drivers.length === 0 ? (
        <div className="text-center p-12 mt-8">
          <CheckCircle className="w-9 h-9 mx-auto text-success" />
          <h3 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-1">All caught up</h3>
          <p className="text-sm text-stone m-0">No pending driver verifications.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {drivers.map((driver) => {
            const profileImage = driver.documents?.find(
              (doc) => doc.documentType === 'profile_photo'
            );

            return (
              <Fragment key={driver.id}>
                <div className="card-list p-4">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-3">
                      {profileImage && (
                        <img
                          src={getFileUrl(profileImage.filePath)}
                          alt={driver.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-border"
                        />
                      )}
                      <strong>{driver.name}</strong>
                    </div>
                    <span className={badgeClass('pending')}>Pending</span>
                  </div>
                  <p className="text-sm text-stone my-0.5">{driver.email}</p>
                  {driver.phone && <p className="text-sm text-stone my-0.5">{driver.phone}</p>}
                  <p className="text-sm text-stone my-0.5">Registered: {new Date(driver.createdAt).toLocaleDateString()}</p>

                  <div className="my-3 flex flex-col gap-1.5">
                    {driver.documents.filter((d) => d.status === 'pending').map((doc) => {
                      const docLabel = doc.documentType === 'license' ? "Driver's License"
                        : doc.documentType === 'registration' ? 'Vehicle Registration'
                        : 'Profile Photo';
                      return (
                        <div key={doc.id} className="flex justify-between items-center text-sm">
                          <span className="text-charcoal">{docLabel}</span>
                          <button
                            className="text-coral no-underline font-medium text-xs border-none bg-transparent cursor-pointer hover:underline"
                            onClick={() => {
                              const docs = driver.documents.filter(d => d.status === 'pending');
                              const idx = docs.findIndex(d => d.id === doc.id);
                              setPreviewImages(docs.map(d => ({ url: getFileUrl(d.filePath), label: d.documentType === 'license' ? "Driver's License" : d.documentType === 'registration' ? 'Vehicle Registration' : 'Profile Photo' })));
                              setPreviewIndex(idx);
                            }}
                          >
                            View
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      className="btn btn-primary btn-success flex-1"
                      disabled={actioning === driver.id}
                      onClick={() => handleReview(driver.id, 'approved')}
                    >
                      {actioning === driver.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      className="btn btn-danger flex-1"
                      disabled={actioning === driver.id}
                      onClick={() => setRejectingUserId(driver.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {rejectingUserId === driver.id && (
                  <RejectionModal
                    onConfirm={(reason) => handleReview(driver.id, 'rejected', reason)}
                    onCancel={() => setRejectingUserId(null)}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      {previewImages && (
        <ImagePreviewModal
          images={previewImages}
          currentIndex={previewIndex}
          onClose={() => setPreviewImages(null)}
          onPrev={() => setPreviewIndex((i) => (i > 0 ? i - 1 : previewImages.length - 1))}
          onNext={() => setPreviewIndex((i) => (i < previewImages.length - 1 ? i + 1 : 0))}
        />
      )}
    </div>
  );
}

export default AdminVerification;
