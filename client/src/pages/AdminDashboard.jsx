import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await adminAPI.getStats();
        if (mounted) setStats(res.data.data);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-stone-light text-sm">Loading...</div>;

  const s = stats?.stats;

  const cards = [
    { label: 'Total Users', value: s?.totalUsers || 0, color: 'text-navy' },
    { label: 'Total Rides', value: s?.totalRides || 0, color: 'text-navy' },
    { label: 'Revenue', value: s?.totalRevenue ? `${s.totalRevenue} PKR` : '0 PKR', color: 'text-success', mono: true },
    { label: 'Pending Verifications', value: s?.pendingVerifications || 0, color: 'text-warning' },
    { label: 'Active SOS', value: s?.activeSOS || 0, color: 'text-error' },
    { label: 'Open Disputes', value: s?.openDisputes || 0, color: 'text-error' },
  ];

  const quickLinks = [
    { to: '/admin/verifications', label: 'Verifications', desc: `${s?.pendingVerifications || 0} pending` },
    { to: '/admin/sos', label: 'SOS Alerts', desc: `${s?.activeSOS || 0} active` },
    { to: '/admin/geo-fence', label: 'Geo-Fence', desc: 'Manage service areas' },
    { to: '/admin/users', label: 'Users', desc: 'Manage all users' },
    { to: '/admin/rides', label: 'Rides', desc: 'Monitor all rides' },
    { to: '/admin/payments', label: 'Payments', desc: 'Revenue & payment tracking' },
    { to: '/admin/disputes', label: 'Disputes', desc: `${s?.openDisputes || 0} open` },
    { to: '/admin/activity', label: 'Activity', desc: 'System activity log' },
  ];

  return (
    <div className="page-wide">
      <div className="page-header page-header-accent">
        <h1>Admin</h1>
        <p>Dashboard</p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-[480px]:grid-cols-2 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <span className={`stat-card-value ${c.color} ${c.mono ? 'font-mono' : ''}`}>{c.value}</span>
            <span className="stat-card-label">{c.label}</span>
          </div>
        ))}
      </div>

      <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Quick Actions</h3>
      <div className="grid grid-cols-2 max-[480px]:grid-cols-1 gap-3">
        {quickLinks.map((link) => (
          <div
            key={link.to}
            className="card p-4 cursor-pointer hover:border-coral hover:bg-coral-light transition"
            onClick={() => navigate(link.to)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-navy">{link.label}</span>
              <span className="text-lg text-coral">&rarr;</span>
            </div>
            <p className="m-0 text-xs text-stone mt-1">{link.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboard;
