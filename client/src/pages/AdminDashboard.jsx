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

  if (loading) return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Admin</h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">{user?.name || 'Dashboard'}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-[480px]:grid-cols-2">
        <div className="bg-white border border-border rounded p-5 text-center">
          <span className="font-display text-[2rem] font-bold text-plum leading-none">{pendingDrivers.length}</span>
          <span className="block text-xs text-text-muted mt-1">Pending Verifications</span>
        </div>
        <div className="bg-white border border-border rounded p-5 text-center">
          <span className="font-display text-[2rem] font-bold text-plum leading-none">{pendingDrivers.reduce((sum, d) => sum + d.documents.length, 0)}</span>
          <span className="block text-xs text-text-muted mt-1">Documents to Review</span>
        </div>
        <div className="bg-white border border-border rounded p-5 text-center cursor-pointer flex flex-col items-center justify-center gap-1 hover:border-pink hover:bg-pink-subtle" onClick={() => navigate('/admin/verifications')}>
          <span className="text-sm font-semibold text-pink">Review Queue</span>
          <span className="text-[1.2rem] text-pink">&rarr;</span>
        </div>
      </div>

      {pendingDrivers.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-plum mb-3 tracking-[-0.01em] m-0">Pending Driver Verifications</h3>
          <div className="flex flex-col gap-2">
            {pendingDrivers.map((driver) => (
              <div key={driver.id} className="flex items-center gap-3 px-4 py-3.5 bg-white border border-border rounded-sm">
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-plum">{driver.name}</span>
                  <span className="text-xs text-text-muted">{driver.email}</span>
                  <span className="text-xs text-text-light">Registered {new Date(driver.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-1">
                  {driver.documents.filter((d) => d.status === 'pending').map((d) => (
                    <span key={d.id} className="text-xs bg-pink-subtle text-pink px-2 py-0.5 rounded font-medium">{d.documentType === 'license' ? 'License' : d.documentType === 'registration' ? 'Registration' : 'Photo'}</span>
                  ))}
                </div>
                <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-xs border-none rounded-sm px-3.5 py-1.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" onClick={() => navigate('/admin/verifications')}>
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingDrivers.length === 0 && (
        <div className="text-center p-12 mt-8">
          <div className="text-4xl mb-2">&#10004;&#65039;</div>
          <h3 className="font-display text-[1.2rem] font-semibold text-plum m-0 mb-1">All caught up</h3>
          <p className="text-sm text-text-muted m-0">No pending driver verifications.</p>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
