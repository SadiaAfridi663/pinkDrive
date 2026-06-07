import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

function AdminVerification() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actioning, setActioning] = useState(null);
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

  const handleReview = async (userId, action) => {
    setActioning(userId);
    setError('');
    setMessage('');
    try {
      const note = action === 'rejected' ? prompt('Reason for rejection:') : null;
      if (action === 'rejected' && !note) return;
      const res = await adminAPI.reviewVerification(userId, action, note);
      setMessage(res.data.message);
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
      cancelled: 'bg-[#f5f5f5] text-text-light',
    };
    return `${base} ${colors[status] || colors.pending}`;
  };

  if (loading && drivers.length === 0) return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Verifications</h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">Review driver document submissions</p>
      </div>

      {error && <p className="bg-[#fff5f5] text-error border border-[#ffcdd2] px-3.5 py-2.5 rounded-sm text-sm mb-2">{error}</p>}
      {message && <p className="bg-[#f1faf1] text-success border border-[#c8e6c9] px-3.5 py-2.5 rounded-sm text-sm mb-2">{message}</p>}

      {drivers.length === 0 ? (
        <div className="text-center p-12 mt-8">
          <div className="text-4xl mb-2">&#10004;&#65039;</div>
          <h3 className="font-display text-[1.2rem] font-semibold text-plum m-0 mb-1">All caught up</h3>
          <p className="text-sm text-text-muted m-0">No pending driver verifications.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {drivers.map((driver) => (
            <div key={driver.id} className="bg-white border border-border rounded-sm p-4">
              <div className="flex justify-between items-center mb-1">
                <strong>{driver.name}</strong>
                <span className={badgeClass('pending')}>Pending</span>
              </div>
              <p className="text-sm text-text-muted my-0.5">{driver.email}</p>
              {driver.phone && <p className="text-sm text-text-muted my-0.5">{driver.phone}</p>}
              <p className="text-sm text-text-muted my-0.5">Registered: {new Date(driver.createdAt).toLocaleDateString()}</p>

              <div className="my-3 flex flex-col gap-1.5">
                {driver.documents.filter((d) => d.status === 'pending').map((doc) => (
                  <div key={doc.id} className="flex justify-between items-center text-sm">
                    <span className="text-text">
                      {doc.documentType === 'license' && "Driver's License"}
                      {doc.documentType === 'registration' && 'Vehicle Registration'}
                      {doc.documentType === 'profile_photo' && 'Profile Photo'}
                    </span>
                    <a
                      href={`http://localhost:5000/${doc.filePath.replace(/\\/g, '/')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink no-underline font-medium text-xs hover:underline"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  className="flex-1 px-2 py-2 border-none rounded-sm text-sm font-semibold cursor-pointer bg-[#e8f5e9] text-success hover:bg-[#c8e6c9] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={actioning === driver.id}
                  onClick={() => handleReview(driver.id, 'approved')}
                >
                  {actioning === driver.id ? 'Processing...' : 'Approve'}
                </button>
                <button
                  className="flex-1 px-2 py-2 border-none rounded-sm text-sm font-semibold cursor-pointer bg-[#ffebee] text-error hover:bg-[#ffcdd2] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={actioning === driver.id}
                  onClick={() => handleReview(driver.id, 'rejected')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminVerification;
