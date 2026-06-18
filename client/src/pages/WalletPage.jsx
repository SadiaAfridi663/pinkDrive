import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { walletAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const status = searchParams.get('status');
    if (sessionId && status === 'success') {
      walletAPI.confirmTopup(sessionId).then(() => {
        setMessage('Wallet topped up successfully!');
        fetchWallet();
      }).catch(() => setError('Failed to confirm top-up.'));
    }
  }, []);

  const fetchWallet = async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        walletAPI.getWallet(),
        walletAPI.getTransactions({ limit: 20 }),
      ]);
      setWallet(walletRes.data.data.wallet);
      setTransactions(txRes.data.data.transactions);
    } catch {
      setError('Failed to load wallet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallet(); }, []);

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) { setError('Enter a valid amount.'); return; }
    setTopupLoading(true);
    setError('');
    try {
      const res = await walletAPI.topup(amount);
      window.location.href = res.data.data.url;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate top-up.');
    } finally {
      setTopupLoading(false);
    }
  };

  const txTypeLabel = (t) => {
    const labels = {
      topup: 'Top-Up',
      ride_payment: 'Ride Payment',
      ride_earnings: 'Ride Earnings',
      refund: 'Refund',
      payout: 'Payout',
      withdrawal: 'Withdrawal',
    };
    return labels[t.type] || t.type;
  };

  if (loading) return <div className="page"><div className="space-y-3"><div className="loading-skeleton h-8 w-1/3" /><div className="loading-skeleton h-4 w-2/3" /></div></div>;

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Wallet</h1>
        <p>Manage your balance and transactions</p>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {message && <p className="msg msg-success">{message}</p>}

      <div className="card p-6 mb-6 text-center">
        <p className="text-sm text-stone m-0 mb-1">Current Balance</p>
        <p className="text-4xl font-bold font-mono text-navy m-0 mb-4">{wallet?.balance ? `${parseFloat(wallet.balance).toLocaleString()} PKR` : '0 PKR'}</p>
        <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
          <input
            className="input flex-1 text-center"
            type="number"
            min="50"
            step="50"
            placeholder="Amount (PKR)"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleTopup} disabled={topupLoading || !topupAmount}>
            {topupLoading ? '...' : 'Top Up'}
          </button>
        </div>
      </div>

      {user?.role === 'driver' && (
        <div className="flex gap-2 mb-4">
          <button className="btn btn-secondary flex-1" onClick={() => navigate('/wallet/earnings')}>
            View Earnings
          </button>
          <button className="btn btn-primary flex-1" onClick={() => navigate('/wallet/withdraw')}>
            Withdraw
          </button>
        </div>
      )}

      <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Recent Transactions</h3>

      {transactions.length === 0 ? (
        <div className="text-center p-12 card">
          <p className="text-sm text-stone m-0">No transactions yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {transactions.map((t) => (
            <div key={t.id} className="card-list flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-navy">{txTypeLabel(t)}</span>
                <span className="text-xs text-stone-light">{t.description || ''} · {new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
              <span className={`font-mono text-sm font-semibold ${t.direction === 'credit' ? 'text-success' : 'text-error'}`}>
                {t.direction === 'credit' ? '+' : '-'}{parseFloat(t.amount).toLocaleString()} PKR
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WalletPage;
