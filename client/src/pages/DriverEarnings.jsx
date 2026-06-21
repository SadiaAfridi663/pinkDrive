import { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';

function DriverEarnings() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [walRes, txRes] = await Promise.all([
          walletAPI.getWithdrawable().catch(() => null),
          walletAPI.getTransactions({ limit: 50 }),
        ]);
        if (walRes) setWallet(walRes.data.data);
        setTransactions(txRes.data.data.transactions);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <div className="page"><div className="loading-skeleton h-8 w-1/3" /></div>;

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Driver Earnings</h1>
        <p>Your earnings and transaction history</p>
      </div>

      {wallet && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4 text-center">
            <p className="text-xs text-stone m-0 mb-1">Wallet Balance</p>
            <p className="text-lg font-bold font-mono text-success m-0">{wallet.walletBalance.toFixed(2)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-stone m-0 mb-1">Total Earnings</p>
            <p className="text-lg font-bold font-mono text-navy m-0">{wallet.totalEarnings.toFixed(2)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-stone m-0 mb-1">Commission Due</p>
            <p className="text-lg font-bold font-mono text-warning m-0">{wallet.commissionDue.toFixed(2)}</p>
          </div>
        </div>
      )}

      <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">All Transactions</h3>

      {transactions.length === 0 ? (
        <div className="text-center p-12 card">
          <p className="text-sm text-stone m-0">No transactions yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {transactions.map((t) => (
            <div key={t.id} className="card-list flex items-center justify-between">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm font-medium text-navy truncate">{t.description || t.type}</span>
                <span className="text-xs text-stone-light">{new Date(t.createdAt).toLocaleDateString()} · {t.type.replace(/_/g, ' ')}</span>
              </div>
              <span className={`font-mono text-sm font-semibold whitespace-nowrap ml-3 ${t.direction === 'credit' ? 'text-success' : 'text-error'}`}>
                {t.direction === 'credit' ? '+' : '-'}{parseFloat(t.amount).toLocaleString()} PKR
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DriverEarnings;
