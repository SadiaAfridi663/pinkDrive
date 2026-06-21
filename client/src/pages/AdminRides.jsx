import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import AddressLabel from '../components/AddressLabel';
import Avatar from '../components/Avatar';

  const PAYMENT_STATUS_COLORS = {
    paid: 'bg-[#e8f5e9] text-success',
    pending: 'bg-[#fff8e1] text-warning',
    failed: 'bg-[#ffebee] text-error',
    refunded: 'bg-[#f3e5f5] text-[#7b1fa2]',
  };

  const STATUS_COLORS = {
  pending: 'bg-[#fff8e1] text-warning',
  accepted: 'bg-[#e3f2fd] text-[#1565c0]',
  arrived: 'bg-[#e3f2fd] text-[#1565c0]',
  in_progress: 'bg-[#f3e5f5] text-[#7b1fa2]',
  completed: 'bg-[#e8f5e9] text-success',
  cancelled: 'bg-[#f5f5f5] text-stone-light',
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AdminRides() {
  const [rides, setRides] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRides = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await adminAPI.getAllRides(params);
      const d = res.data.data;
      setRides(d.rides);
      setTotal(d.total);
      setPages(d.pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  return (
    <div className="page-wide">
      <div className="mb-6">
        <h1 className="font-display text-[2.2rem] font-bold text-navy tracking-[-0.02em] leading-[1.15] m-0">Rides</h1>
        <p className="text-[0.95rem] text-stone mt-1 m-0">{total} total rides</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-border rounded-sm bg-white text-charcoal placeholder:text-stone-light focus:outline-none focus:border-coral"
          placeholder="Search by address..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="px-3 py-2 text-sm border border-border rounded-sm bg-white text-charcoal focus:outline-none focus:border-coral"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="arrived">Arrived</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-light text-sm">Loading...</div>
      ) : rides.length === 0 ? (
        <div className="text-center p-12 card">
          <h3 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-1">No rides found</h3>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ivory text-stone text-xs uppercase tracking-[0.05em]">
                <th className="text-left px-4 py-3 font-semibold">Passenger</th>
                <th className="text-left px-4 py-3 font-semibold">Driver</th>
                <th className="text-left px-4 py-3 font-semibold">Pickup</th>
                <th className="text-left px-4 py-3 font-semibold">Dropoff</th>
                <th className="text-left px-4 py-3 font-semibold">Fare</th>
                <th className="text-left px-4 py-3 font-semibold">Payment</th>
                <th className="text-left px-4 py-3 font-semibold">Payment Status</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {rides.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-ivory/50 cursor-pointer" onClick={() => navigate(`/admin/rides/${r.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.passenger?.name || 'Passenger'} size="sm" />
                      <span className="font-medium text-navy">{r.passenger?.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.driver ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={r.driver.name} size="sm" />
                        <span className="text-navy">{r.driver.name}</span>
                      </div>
                    ) : (
                      <span className="text-stone-light text-xs">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone max-w-[140px] truncate"><AddressLabel address={r.pickupAddress} lat={r.pickupLat} lng={r.pickupLng} /></td>
                  <td className="px-4 py-3 text-stone max-w-[140px] truncate"><AddressLabel address={r.dropoffAddress} lat={r.dropoffLat} lng={r.dropoffLng} /></td>
                  <td className="px-4 py-3 font-mono">{r.fare ? `${r.fare} PKR` : 'N/A'}</td>
                  <td className="px-4 py-3 capitalize text-navy">{r.paymentMethod || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${PAYMENT_STATUS_COLORS[r.paymentStatus] || ''}`}>{r.paymentStatus || 'N/A'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-light text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="px-3 py-1.5 text-sm border border-border rounded-sm bg-white text-stone hover:border-coral hover:text-coral disabled:opacity-30 cursor-pointer transition" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="text-sm text-stone">Page {page} of {pages}</span>
          <button className="px-3 py-1.5 text-sm border border-border rounded-sm bg-white text-stone hover:border-coral hover:text-coral disabled:opacity-30 cursor-pointer transition" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

export default AdminRides;
