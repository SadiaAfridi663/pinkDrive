import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

function AdminActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await adminAPI.getActivities();
        if (mounted) setActivities(res.data.data.activities);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = filter ? activities.filter((a) => a.type === filter) : activities;

  return (
    <div className="page-wide">
      <div className="mb-6">
        <h1 className="font-display text-[2.2rem] font-bold text-navy tracking-[-0.02em] leading-[1.15] m-0">Activity Log</h1>
        <p className="text-[0.95rem] text-stone mt-1 m-0">Recent system events and alerts</p>
      </div>

      <div className="mb-4">
        <select
          className="px-3 py-2 text-sm border border-border rounded-sm bg-white text-charcoal focus:outline-none focus:border-coral"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All events</option>
          <option value="SOS_ALERT">SOS Alerts</option>
          <option value="CANCELLATION">Cancellations</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-light text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-12 card">
          <h3 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-1">No activity</h3>
          <p className="text-sm text-stone m-0">No system events recorded yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 card-list ${a.severity === 'critical' ? 'border-error/30' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${a.severity === 'critical' ? 'bg-[#ffebee] text-error' : 'bg-[#fff8e1] text-warning'}`}>
                {a.severity === 'critical' ? '!' : '~'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="m-0 text-sm text-charcoal">{a.message}</p>
                <p className="m-0 text-xs text-stone-light mt-0.5">{new Date(a.date).toLocaleString()}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded flex-shrink-0 ${a.severity === 'critical' ? 'bg-[#ffebee] text-error' : 'bg-[#fff8e1] text-warning'}`}>
                {a.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminActivity;
