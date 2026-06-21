import { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';

const METHODS = ['bank', 'jazzcash', 'easypaisa'];
const METHOD_LABELS = { bank: 'Bank Account', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa' };
const METHOD_HINTS = { bank: 'Account title, bank name & IBAN', jazzcash: 'JazzCash phone number', easypaisa: 'EasyPaisa phone number' };

function DriverWithdraw() {
  const [data, setData] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [accountDetails, setAccountDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    try {
      const [balRes, wdRes] = await Promise.all([
        walletAPI.getWithdrawable(),
        walletAPI.getWithdrawals({ limit: 50 }),
      ]);
      setData(balRes.data.data);
      setWithdrawals(wdRes.data.data.withdrawals);
    } catch {
      setError('Failed to load withdrawal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }
    if (data && amt > data.withdrawable) { setError(`Amount exceeds withdrawable balance (${data.withdrawable.toFixed(2)} PKR).`); return; }
    if (!accountDetails.trim()) { setError('Enter your account details.'); return; }

    setSubmitting(true);
    setError('');
    try {
      await walletAPI.requestWithdrawal({ amount: amt, method, accountDetails: accountDetails.trim() });
      setSuccess('Withdrawal request submitted for admin approval.');
      setAmount('');
      setAccountDetails('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit withdrawal.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page"><div className="loading-skeleton h-8 w-1/3" /><div className="loading-skeleton h-4 w-2/3 mt-3" /></div>;

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Withdraw Earnings</h1>
        <p>Request a payout to your bank or mobile wallet</p>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {success && <p className="msg msg-success">{success}</p>}

      {/* Balance summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-xs text-stone m-0 mb-1">Wallet Balance</p>
          <p className="text-lg font-bold font-mono text-success m-0">{data?.walletBalance?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-stone m-0 mb-1">Commission Due</p>
          <p className="text-lg font-bold font-mono text-warning m-0">{data?.commissionDue?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-stone m-0 mb-1">Pending Withdrawals</p>
          <p className="text-lg font-bold font-mono text-warning m-0">{data?.pendingWithdrawals?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-stone m-0 mb-1">Withdrawable</p>
          <p className="text-lg font-bold font-mono text-success m-0">{data?.withdrawable?.toFixed(2) || '0.00'}</p>
        </div>
      </div>

      {/* Withdrawal form */}
      <div className="card p-5 mb-6">
        <h3 className="font-display text-sm font-semibold text-navy mb-4">New Withdrawal Request</h3>

        <div className="mb-3">
          <label className="label">Amount (PKR)</label>
          <input className="input" type="number" min="100" step="50" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="label">Payment Method</label>
          <div className="flex gap-2">
            {METHODS.map((m) => (
              <button key={m} className={`btn flex-1 text-sm ${method === m ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setMethod(m); setAccountDetails(''); }}>
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="label">{METHOD_HINTS[method]}</label>
          <input className="input" placeholder={method === 'bank' ? 'e.g. Muhammad Fatima · HBL · PK36XXXX...' : 'e.g. 03XX-XXXXXXX'} value={accountDetails} onChange={(e) => setAccountDetails(e.target.value)} />
        </div>

        <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={submitting || !amount || !accountDetails}>
          {submitting ? 'Submitting...' : `Request Withdrawal`}
        </button>
      </div>

      {/* Withdrawal history */}
      <h3 className="font-display text-sm font-semibold text-navy mb-3">Withdrawal History</h3>
      {withdrawals.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-stone m-0">No withdrawal requests yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {withdrawals.map((w) => (
            <div key={w.id} className="card-list flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-navy">{parseFloat(w.amount).toLocaleString()} PKR via {METHOD_LABELS[w.method] || w.method}</span>
                <span className="text-xs text-stone-light">{new Date(w.createdAt).toLocaleDateString()} {w.adminNote ? `· ${w.adminNote}` : ''}</span>
              </div>
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-sm ${
                w.status === 'approved' ? 'bg-[#e8f5e9] text-success' :
                w.status === 'rejected' ? 'bg-[#ffebee] text-error' :
                'bg-[#fff8e1] text-warning'
              }`}>{w.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DriverWithdraw;
