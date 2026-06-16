import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AdminPayments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await adminAPI.getPaymentStats();
        if (mounted) setData(res.data.data);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-stone-light text-sm">Loading...</div>;

  const s = data?.stats;

  const statCards = [
    { label: 'Total Revenue', value: s?.totalRevenue ? `${s.totalRevenue.toLocaleString()} PKR` : '0 PKR', color: 'text-success', mono: true },
    { label: 'Stripe Revenue', value: s?.stripeRevenue ? `${s.stripeRevenue.toLocaleString()} PKR` : '0 PKR', color: 'text-navy', mono: true },
    { label: 'Cash Collected', value: s?.cashRevenue ? `${s.cashRevenue.toLocaleString()} PKR` : '0 PKR', color: 'text-navy', mono: true },
    { label: 'Stripe Payments', value: s?.stripeCount || 0, color: 'text-navy' },
    { label: 'Cash Rides', value: s?.cashCount || 0, color: 'text-navy' },
    { label: 'Pending Payments', value: s?.pendingPayments || 0, color: 'text-warning' },
    { label: 'Failed Payments', value: s?.failedPayments || 0, color: 'text-error' },
  ];

  const recent = data?.recentPayments || [];
  const filtered = filter ? recent.filter(r => r.paymentStatus === filter) : recent;

  return (
    <div className="page-wide">
      <div className="page-header page-header-accent">
        <h1>Payments</h1>
        <p>Revenue and payment tracking</p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-[480px]:grid-cols-2 mb-8">
        {statCards.map((c) => (
          <div key={c.label} className="stat-card">
            <span className={`stat-card-value ${c.color} ${c.mono ? 'font-mono' : ''}`}>{c.value}</span>
            <span className="stat-card-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-navy mb-0 m-0">Stripe Payments</h3>
        <select
          className="px-3 py-1.5 text-sm border border-border rounded-sm bg-white text-charcoal focus:outline-none focus:border-coral"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center p-12 card">
          <h3 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-1">No payments found</h3>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ivory text-stone text-xs uppercase tracking-[0.05em]">
                <th className="text-left px-4 py-3 font-semibold">Ride ID</th>
                <th className="text-left px-4 py-3 font-semibold">Passenger</th>
                <th className="text-left px-4 py-3 font-semibold">Driver</th>
                <th className="text-left px-4 py-3 font-semibold">Amount</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Payment</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border hover:bg-ivory/50 cursor-pointer"
                  onClick={() => navigate(`/admin/rides/${r.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-stone">{r.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-medium text-navy">{r.passengerName}</td>
                  <td className="px-4 py-3 text-navy">{r.driverName || 'N/A'}</td>
                  <td className="px-4 py-3 font-mono">{r.fare ? `${r.fare} PKR` : 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${
                      r.status === 'completed' ? 'bg-[#e8f5e9] text-success' :
                      r.status === 'cancelled' ? 'bg-[#f5f5f5] text-stone-light' :
                      'bg-[#fff8e1] text-warning'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${
                      r.paymentStatus === 'paid' ? 'bg-[#e8f5e9] text-success' :
                      r.paymentStatus === 'failed' ? 'bg-[#ffebee] text-error' :
                      'bg-[#fff8e1] text-warning'
                    }`}>{r.paymentStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-light text-xs">{new Date(r.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminPayments;
