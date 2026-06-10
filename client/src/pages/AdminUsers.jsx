import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../services/api';
import Avatar from '../components/Avatar';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await adminAPI.getUsers(params);
      const d = res.data.data;
      setUsers(d.users);
      setTotal(d.total);
      setPages(d.pages);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSuspend = async (userId, name) => {
    if (!window.confirm(`Toggle suspension for ${name}?`)) return;
    try {
      const res = await adminAPI.suspendUser(userId);
      setMessage(res.data.message);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user.');
    }
  };

  return (
    <div className="page-wide">
      <div className="mb-6">
        <h1 className="font-display text-[2.2rem] font-bold text-navy tracking-[-0.02em] leading-[1.15] m-0">Users</h1>
        <p className="text-[0.95rem] text-stone mt-1 m-0">{total} total users</p>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {message && <p className="msg msg-success">{message}</p>}

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-border rounded-sm bg-white text-charcoal placeholder:text-stone-light focus:outline-none focus:border-coral"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="px-3 py-2 text-sm border border-border rounded-sm bg-white text-charcoal focus:outline-none focus:border-coral"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All roles</option>
          <option value="passenger">Passenger</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-light text-sm">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center p-12 card">
          <h3 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-1">No users found</h3>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ivory text-stone text-xs uppercase tracking-[0.05em]">
                <th className="text-left px-4 py-3 font-semibold">User</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Phone</th>
                <th className="text-left px-4 py-3 font-semibold">Role</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Driver Verified</th>
                <th className="text-left px-4 py-3 font-semibold">Joined</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-ivory/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} size="sm" />
                      <span className="font-medium text-navy">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone">{u.email}</td>
                  <td className="px-4 py-3 text-stone font-mono text-xs">{u.phone || '—'}</td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3">
                    {u.isSuspended ? (
                      <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-[#ffebee] text-error">Suspended</span>
                    ) : u.isVerified ? (
                      <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-[#e8f5e9] text-success">Active</span>
                    ) : (
                      <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-[#fff8e1] text-warning">Unverified</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'driver' ? (
                      u.isDriverVerified ? (
                        <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-[#e8f5e9] text-success">Verified</span>
                      ) : (
                        <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-[#fff8e1] text-warning">Pending</span>
                      )
                    ) : (
                      <span className="text-stone-light text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-light text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'admin' && (
                      <button
                        className={`px-2.5 py-1 text-xs font-semibold border rounded-sm cursor-pointer transition ${u.isSuspended ? 'border-success text-success hover:bg-[#e8f5e9]' : 'border-error text-error hover:bg-[#ffebee]'}`}
                        onClick={() => handleSuspend(u.id, u.name)}
                      >
                        {u.isSuspended ? 'Activate' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            className="px-3 py-1.5 text-sm border border-border rounded-sm bg-white text-stone hover:border-coral hover:text-coral disabled:opacity-30 cursor-pointer transition"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </button>
          <span className="text-sm text-stone">Page {page} of {pages}</span>
          <button
            className="px-3 py-1.5 text-sm border border-border rounded-sm bg-white text-stone hover:border-coral hover:text-coral disabled:opacity-30 cursor-pointer transition"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;