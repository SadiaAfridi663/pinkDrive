import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

const STATUS_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
const METHOD_LABELS = { bank: 'Bank', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa' };

function AdminWallet() {
  const [tab, setTab] = useState('withdrawals');
  const [withdrawals, setWithdrawals] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [actionId, setActionId] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const [selectedWallet, setSelectedWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('credit');
  const [adjustReason, setAdjustReason] = useState('');

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

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getDriverWallets();
      setWallets(res.data.data.wallets);
    } catch {
      setError('Failed to load wallets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'withdrawals') fetchWithdrawals();
    else fetchWallets();
  }, [tab, filter]);

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

  const handleWalletClick = async (userId) => {
    try {
      const res = await adminAPI.getDriverWalletById(userId);
      setSelectedWallet(res.data.data.wallet);
      setTransactions(res.data.data.transactions);
      setAdjustAmount('');
      setAdjustType('credit');
      setAdjustReason('');
    } catch {
      setError('Failed to load wallet details.');
    }
  };

  const handleSettle = async (userId) => {
    setProcessing(true);
    setError('');
    try {
      const res = await adminAPI.settleCommission(userId);
      setError('');
      handleWalletClick(userId);
      fetchWallets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to settle commission.');
    } finally {
      setProcessing(false);
    }
  };

  const handleAdjust = async (userId) => {
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) { setError('Valid amount required.'); return; }
    if (!adjustReason.trim()) { setError('Reason required.'); return; }
    setProcessing(true);
    setError('');
    try {
      await adminAPI.adjustWallet(userId, { amount: amt, type: adjustType, reason: adjustReason.trim() });
      handleWalletClick(userId);
      fetchWallets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to adjust wallet.');
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
        <p>Manage driver wallets and withdrawal requests</p>
      </div>

      {error && <p className="msg msg-error">{error}</p>}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button className={`btn btn-sm ${tab === 'withdrawals' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('withdrawals'); setSelectedWallet(null); }}>
          Withdrawals
        </button>
        <button className={`btn btn-sm ${tab === 'wallets' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('wallets'); setSelectedWallet(null); }}>
          Driver Wallets
        </button>
      </div>

      {tab === 'withdrawals' && (
        <>
          <div className="flex gap-2 mb-5">
            {['pending', 'approved', 'rejected', ''].map((s) => (
              <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
                {s ? STATUS_LABELS[s] : 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="loading-skeleton h-16 rounded-sm" />)}</div>
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
        </>
      )}

      {tab === 'wallets' && (
        <>
          {selectedWallet ? (
            <div>
              <button className="btn btn-secondary btn-sm mb-4" onClick={() => setSelectedWallet(null)}>← Back to wallets</button>

              <div className="card p-5 mb-4">
                <h3 className="font-display text-base font-semibold text-navy mb-3">
                  {selectedWallet.user?.name || `User #${selectedWallet.userId}`} — Wallet
                </h3>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-stone m-0 mb-1">Balance</p>
                    <p className="text-lg font-bold font-mono text-success m-0">{selectedWallet.balance.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-stone m-0 mb-1">Commission Due</p>
                    <p className="text-lg font-bold font-mono text-warning m-0">{selectedWallet.commissionDue.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-stone m-0 mb-1">Total Earnings</p>
                    <p className="text-lg font-bold font-mono text-navy m-0">{selectedWallet.totalEarnings.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-stone m-0 mb-1">Withdrawn</p>
                    <p className="text-lg font-bold font-mono text-navy m-0">{selectedWallet.totalWithdrawn.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <button className="btn btn-sm btn-primary" onClick={() => handleSettle(selectedWallet.userId)} disabled={processing}>
                    {processing ? '...' : 'Settle Commission'}
                  </button>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-display text-sm font-semibold text-navy mb-3">Adjust Balance</h4>
                  <div className="flex gap-2 mb-2">
                    <input className="input text-sm flex-1" type="number" min="1" step="10" placeholder="Amount" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                    <select className="input text-sm w-auto" value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                      <option value="credit">Credit</option>
                      <option value="debit">Debit</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input className="input text-sm flex-1" placeholder="Reason for adjustment" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                    <button className="btn btn-sm btn-primary" onClick={() => handleAdjust(selectedWallet.userId)} disabled={processing || !adjustAmount || !adjustReason}>
                      {processing ? '...' : 'Apply'}
                    </button>
                  </div>
                </div>
              </div>

              <h4 className="font-display text-sm font-semibold text-navy mb-3">Recent Transactions</h4>
              {transactions.length === 0 ? (
                <div className="card p-4 text-center"><p className="text-sm text-stone m-0">No transactions.</p></div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
                  {transactions.map((t) => (
                    <div key={t.id} className="card-list flex items-center justify-between">
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="text-xs font-medium text-navy truncate">{t.description || t.type}</span>
                        <span className="text-[0.65rem] text-stone-light">{new Date(t.createdAt).toLocaleString()} · {t.type}</span>
                      </div>
                      <span className={`font-mono text-xs font-semibold whitespace-nowrap ml-3 ${t.direction === 'credit' ? 'text-success' : 'text-error'}`}>
                        {t.direction === 'credit' ? '+' : '-'}{parseFloat(t.amount).toLocaleString()} PKR
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="loading-skeleton h-16 rounded-sm" />)}</div>
              ) : wallets.length === 0 ? (
                <div className="card p-8 text-center"><p className="text-sm text-stone m-0">No driver wallets found.</p></div>
              ) : (
                <div className="flex flex-col gap-2">
                  {wallets.map((w) => (
                    <div key={w.id} className="card p-4 cursor-pointer hover:shadow-md transition" onClick={() => handleWalletClick(w.userId)}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-navy m-0 truncate">{w.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-stone-light m-0 truncate">{w.user?.email || ''} · {w.user?.phone || ''}</p>
                        </div>
                        <div className="flex gap-4 text-right ml-4">
                          <div>
                            <p className="text-[0.6rem] uppercase tracking-wide text-stone m-0">Balance</p>
                            <p className="text-sm font-bold font-mono text-success m-0">{w.balance.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[0.6rem] uppercase tracking-wide text-stone m-0">Commission Due</p>
                            <p className="text-sm font-bold font-mono text-warning m-0">{w.commissionDue.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[0.6rem] uppercase tracking-wide text-stone m-0">Earnings</p>
                            <p className="text-sm font-bold font-mono text-navy m-0">{w.totalEarnings.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default AdminWallet;
