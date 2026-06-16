import { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';

function DriverEarnings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await walletAPI.getDriverEarnings({ limit: 50 });
        setData(res.data.data);
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
        <p>Your ride earnings history</p>
      </div>

      <div className="card p-6 mb-6 text-center">
        <p className="text-sm text-stone m-0 mb-1">Total Earnings</p>
        <p className="text-4xl font-bold font-mono text-success m-0">{data?.total ? `${parseFloat(data.total).toLocaleString()} PKR` : '0 PKR'}</p>
      </div>

      <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Earnings History</h3>

      {data?.transactions?.length === 0 ? (
        <div className="text-center p-12 card">
          <p className="text-sm text-stone m-0">No earnings yet. Complete rides to earn.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {data?.transactions?.map((t) => (
            <div key={t.id} className="card-list flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-navy">{t.description || 'Ride'}</span>
                <span className="text-xs text-stone-light">{new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
              <span className="font-mono text-sm font-semibold text-success">+{parseFloat(t.amount).toLocaleString()} PKR</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DriverEarnings;
