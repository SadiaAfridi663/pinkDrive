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

  if (loading && drivers.length === 0) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Verifications</h1>
        <p className="page-subtitle">Review driver document submissions</p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      {drivers.length === 0 ? (
        <div className="empty-section">
          <div className="empty-icon">✅</div>
          <h3>All caught up</h3>
          <p>No pending driver verifications.</p>
        </div>
      ) : (
        <div className="admin-list">
          {drivers.map((driver) => (
            <div key={driver.id} className="admin-driver-card">
              <div className="admin-driver-header">
                <strong>{driver.name}</strong>
                <span className="badge badge--pending">Pending</span>
              </div>
              <p className="admin-driver-detail">{driver.email}</p>
              {driver.phone && <p className="admin-driver-detail">{driver.phone}</p>}
              <p className="admin-driver-detail">Registered: {new Date(driver.createdAt).toLocaleDateString()}</p>

              <div className="admin-docs">
                {driver.documents.filter((d) => d.status === 'pending').map((doc) => (
                  <div key={doc.id} className="admin-doc-row">
                    <span className="admin-doc-type">
                      {doc.documentType === 'license' && "Driver's License"}
                      {doc.documentType === 'registration' && 'Vehicle Registration'}
                      {doc.documentType === 'profile_photo' && 'Profile Photo'}
                    </span>
                    <a
                      href={`http://localhost:5000/${doc.filePath.replace(/\\/g, '/')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-doc-link"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>

              <div className="admin-actions">
                <button
                  className="btn-approve"
                  disabled={actioning === driver.id}
                  onClick={() => handleReview(driver.id, 'approved')}
                >
                  {actioning === driver.id ? 'Processing...' : 'Approve'}
                </button>
                <button
                  className="btn-reject"
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
