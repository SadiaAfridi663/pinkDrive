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

  if (loading) return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;

  const s = stats?.stats;

  const cards = [
    { label: 'Total Users', value: s?.totalUsers || 0, color: 'text-plum' },
    { label: 'Total Rides', value: s?.totalRides || 0, color: 'text-plum' },
    { label: 'Revenue', value: s?.totalRevenue ? `${s.totalRevenue} PKR` : '0 PKR', color: 'text-success', mono: true },
    { label: 'Pending Verifications', value: s?.pendingVerifications || 0, color: 'text-warning' },
    { label: 'Active SOS', value: s?.activeSOS || 0, color: 'text-error' },
  ];

  const quickLinks = [
    { to: '/admin/verifications', label: 'Verifications', desc: `${s?.pendingVerifications || 0} pending` },
    { to: '/admin/sos', label: 'SOS Alerts', desc: `${s?.activeSOS || 0} active` },
    { to: '/admin/geo-fence', label: 'Geo-Fence', desc: 'Manage service areas' },
    { to: '/admin/users', label: 'Users', desc: 'Manage all users' },
    { to: '/admin/rides', label: 'Rides', desc: 'Monitor all rides' },
    { to: '/admin/activity', label: 'Activity', desc: 'System activity log' },
  ];

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Admin</h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">Dashboard</p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-[480px]:grid-cols-2 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-border rounded p-5 text-center">
            <span className={`font-display text-[2rem] font-bold leading-none ${c.color} ${c.mono ? 'font-mono' : ''}`}>{c.value}</span>
            <span className="block text-xs text-text-muted mt-1">{c.label}</span>
          </div>
        ))}
      </div>

      <h3 className="font-display text-base font-semibold text-plum mb-3 tracking-[-0.01em] m-0">Quick Actions</h3>
      <div className="grid grid-cols-2 max-[480px]:grid-cols-1 gap-3">
        {quickLinks.map((link) => (
          <div
            key={link.to}
            className="bg-white border border-border rounded p-4 cursor-pointer hover:border-pink hover:bg-pink-subtle transition"
            onClick={() => navigate(link.to)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-plum">{link.label}</span>
              <span className="text-lg text-pink">&rarr;</span>
            </div>
            <p className="m-0 text-xs text-text-muted mt-1">{link.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboard;
