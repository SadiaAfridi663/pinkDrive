import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const STATUS_COLORS = {
  pending: 'bg-[#fff8e1] text-warning',
  accepted: 'bg-[#e3f2fd] text-[#1565c0]',
  arrived: 'bg-[#e3f2fd] text-[#1565c0]',
  in_progress: 'bg-[#f3e5f5] text-[#7b1fa2]',
  completed: 'bg-[#e8f5e9] text-success',
  cancelled: 'bg-[#f5f5f5] text-text-light',
};

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
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-6">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Rides</h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">{total} total rides</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-border rounded-sm bg-white text-text placeholder:text-text-light focus:outline-none focus:border-pink"
          placeholder="Search by address..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="px-3 py-2 text-sm border border-border rounded-sm bg-white text-text focus:outline-none focus:border-pink"
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
        <div className="text-center py-12 text-text-light text-sm">Loading...</div>
      ) : rides.length === 0 ? (
        <div className="text-center p-12 bg-white border border-border rounded-sm">
          <h3 className="font-display text-[1.2rem] font-semibold text-plum m-0 mb-1">No rides found</h3>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-off-white text-text-muted text-xs uppercase tracking-[0.05em]">
                <th className="text-left px-4 py-3 font-semibold">Passenger</th>
                <th className="text-left px-4 py-3 font-semibold">Pickup</th>
                <th className="text-left px-4 py-3 font-semibold">Dropoff</th>
                <th className="text-left px-4 py-3 font-semibold">Fare</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {rides.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-off-white/50 cursor-pointer" onClick={() => navigate(`/ride/${r.id}`)}>
                  <td className="px-4 py-3 font-medium text-plum">{r.passengerId ? r.passengerId.slice(0, 8) : 'N/A'}</td>
                  <td className="px-4 py-3 text-text-muted max-w-[160px] truncate">{r.pickupAddress || `${r.pickupLat?.toFixed(4)}, ${r.pickupLng?.toFixed(4)}`}</td>
                  <td className="px-4 py-3 text-text-muted max-w-[160px] truncate">{r.dropoffAddress || `${r.dropoffLat?.toFixed(4)}, ${r.dropoffLng?.toFixed(4)}`}</td>
                  <td className="px-4 py-3 font-mono">{r.fare ? `${r.fare} PKR` : 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-light text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="px-3 py-1.5 text-sm border border-border rounded-sm bg-white text-text-muted hover:border-pink hover:text-pink disabled:opacity-30 cursor-pointer transition" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="text-sm text-text-muted">Page {page} of {pages}</span>
          <button className="px-3 py-1.5 text-sm border border-border rounded-sm bg-white text-text-muted hover:border-pink hover:text-pink disabled:opacity-30 cursor-pointer transition" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

export default AdminRides;
