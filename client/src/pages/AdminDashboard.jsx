import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

function AdminDashboard() {
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await adminAPI.getPendingVerifications();
        if (mounted) setPendingDrivers(res.data.data.drivers);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">{user?.name || 'Dashboard'}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-number">{pendingDrivers.length}</span>
          <span className="stat-label">Pending Verifications</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{pendingDrivers.reduce((sum, d) => sum + d.documents.length, 0)}</span>
          <span className="stat-label">Documents to Review</span>
        </div>
        <div className="stat-card stat-card--action" onClick={() => navigate('/admin/verifications')}>
          <span className="stat-action">Review Queue</span>
          <span className="stat-arrow">&rarr;</span>
        </div>
      </div>

      {pendingDrivers.length > 0 && (
        <div className="section">
          <h3 className="section-title">Pending Driver Verifications</h3>
          <div className="admin-pending-list">
            {pendingDrivers.map((driver) => (
              <div key={driver.id} className="admin-pending-row">
                <div className="admin-pending-info">
                  <span className="admin-pending-name">{driver.name}</span>
                  <span className="admin-pending-email">{driver.email}</span>
                  <span className="admin-pending-date">Registered {new Date(driver.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="admin-pending-docs">
                  {driver.documents.filter((d) => d.status === 'pending').map((d) => (
                    <span key={d.id} className="doc-chip">{d.documentType === 'license' ? 'License' : d.documentType === 'registration' ? 'Registration' : 'Photo'}</span>
                  ))}
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => navigate('/admin/verifications')}>
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingDrivers.length === 0 && (
        <div className="empty-section">
          <div className="empty-icon">✅</div>
          <h3>All caught up</h3>
          <p>No pending driver verifications.</p>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
