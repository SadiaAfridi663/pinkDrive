import { useState, useEffect } from 'react';
import { adminAPI, walletAPI } from '../services/api';

const STATUS_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
const METHOD_LABELS = { bank: 'Bank', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa' };

function AdminWallet() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [actionId, setActionId] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const res = await adminAPI.getWithdrawals(params); 
      setWithdrawals(res.data.data.withdrawals);
    } catch {
      setError('Failed to load withdrawals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWithdrawals(); }, [filter]);

  const handleAction = async (id, action) => {
    setProcessing(true);
    setError('');
    try {
      await adminAPI.processWithdrawal(id, { action, adminNote: adminNote.trim() || undefined });
      setActionId(null);
      setAdminNote('');
      fetchWithdrawals();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process withdrawal.');
    } finally {
      setProcessing(false);
    }
  };

  if (!adminAPI.getWithdrawals) {
    return <div className="page"><p className="text-stone">Loading...</p></div>;
  }

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Wallet & Withdrawals</h1>
        <p>Manage driver withdrawal requests</p>
      </div>

      {error && <p className="msg msg-error">{error}</p>}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
            {s ? STATUS_LABELS[s] : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="loading-skeleton h-16 rounded-sm" />)}
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-sm text-stone m-0">No withdrawal requests found.</p></div>
      ) : (
        <div className="flex flex-col gap-2">
          {withdrawals.map((w) => (
            <div key={w.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-navy m-0">{w.user?.name || 'Unknown'} — {parseFloat(w.amount).toLocaleString()} PKR</p>
                  <p className="text-xs text-stone-light m-0">
                    {METHOD_LABELS[w.method] || w.method} · {w.accountDetails}
                  </p>
                  <p className="text-xs text-stone-light m-0">{new Date(w.createdAt).toLocaleString()}</p>
                </div>
                <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-sm ${
                  w.status === 'approved' ? 'bg-[#e8f5e9] text-success' :
                  w.status === 'rejected' ? 'bg-[#ffebee] text-error' :
                  'bg-[#fff8e1] text-warning'
                }`}>{STATUS_LABELS[w.status]}</span>
              </div>

              {w.adminNote && (
                <p className="text-xs text-stone-light m-0 mb-2 italic">Note: {w.adminNote}</p>
              )}

              {w.status === 'pending' && (
                <div>
                  {actionId === w.id ? (
                    <div className="flex flex-col gap-2 mt-2">
                      <input className="input text-sm" placeholder="Admin note (optional)" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
                      <div className="flex gap-2">
                        <button className="btn btn-success btn-sm flex-1" onClick={() => handleAction(w.id, 'approved')} disabled={processing}>
                          {processing ? '...' : 'Approve'}
                        </button>
                        <button className="btn btn-error btn-sm flex-1" onClick={() => handleAction(w.id, 'rejected')} disabled={processing}>
                          {processing ? '...' : 'Reject'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setActionId(null); setAdminNote(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-secondary btn-sm mt-2" onClick={() => { setActionId(w.id); setAdminNote(''); }}>Process</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminWallet;
