import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../services/api';

const STATUS_COLORS = {
  open: 'bg-[#fff8e1] text-[#f57f17]',
  under_review: 'bg-[#e3f2fd] text-[#1565c0]',
  resolved_approved: 'bg-[#e8f5e9] text-success',
  resolved_rejected: 'bg-[#f5f5f5] text-stone-light',
  escalated: 'bg-[#ffebee] text-error',
};

const DISPUTE_TYPE_LABELS = {
  passenger_refused_payment: 'Passenger Refused Payment',
  partial_payment: 'Partial Payment',
  driver_extra_fare: 'Driver Requested Extra Fare',
  driver_false_claim: 'Driver False Claim',
  passenger_false_claim: 'Passenger False Claim',
  digital_payment_failure: 'Digital Payment Failure',
};

function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await adminAPI.getDisputes(params);
      const d = res.data.data;
      setDisputes(d.disputes);
      setTotal(d.total);
      setPages(d.pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const selectDispute = async (id) => {
    try {
      const res = await adminAPI.getDisputeById(id);
      setSelected(res.data.data);
    } catch {
      setMessage('Failed to load dispute details.');
    }
  };

  const resolve = async (action) => {
    setResolving(true);
    try {
      const data = { action };
      if (action === 'add_debt' || (action === 'approve_claim')) {
        const amount = window.prompt('Enter debt amount (PKR):');
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
          setResolving(false);
          return;
        }
        data.debtAmount = parseFloat(amount);
      }
      const note = window.prompt('Admin note (optional):');
      if (note) data.adminNote = note;
      await adminAPI.resolveDispute(selected.dispute.id, data);
      setMessage('Dispute resolved.');
      setSelected(null);
      fetchDisputes();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to resolve.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="page-wide">
      <div className="page-header page-header-accent">
        <h1>Disputes</h1>
        <p>{total} total disputes</p>
      </div>

      {message && <p className="msg msg-success">{message}</p>}

      <div className="flex gap-2 mb-4">
        <select
          className="px-3 py-2 text-sm border border-border rounded-sm bg-white text-charcoal focus:outline-none focus:border-coral"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="resolved_approved">Resolved — Approved</option>
          <option value="resolved_rejected">Resolved — Rejected</option>
          <option value="escalated">Escalated</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-light text-sm">Loading...</div>
      ) : disputes.length === 0 ? (
        <div className="text-center p-12 card">
          <h3 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-1">No disputes found</h3>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ivory text-stone text-xs uppercase tracking-[0.05em]">
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Reported By</th>
                <th className="text-left px-4 py-3 font-semibold">Ride</th>
                <th className="text-left px-4 py-3 font-semibold">Fare</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-ivory/50 cursor-pointer" onClick={() => selectDispute(d.id)}>
                  <td className="px-4 py-3 text-navy">{DISPUTE_TYPE_LABELS[d.disputeType] || d.disputeType}</td>
                  <td className="px-4 py-3 text-navy font-medium">{d.reportedByUser?.name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-navy">{d.ride ? `${d.ride.pickupAddress || ''} → ${d.ride.dropoffAddress || ''}` : 'N/A'}</td>
                  <td className="px-4 py-3 font-mono">{d.ride?.fare ? `${d.ride.fare} PKR` : 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[d.status] || ''}`}>{d.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-light text-xs">{new Date(d.createdAt).toLocaleDateString()}</td>
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

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-sm w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold text-navy m-0">Dispute Details</h3>
                <button className="text-stone-light hover:text-stone text-xl leading-none border-none bg-transparent cursor-pointer" onClick={() => setSelected(null)}>&times;</button>
              </div>

              <div className="flex flex-col gap-3 text-sm mb-4">
                <div><span className="text-stone">Type:</span> <span className="text-navy font-medium ml-1">{DISPUTE_TYPE_LABELS[selected.dispute.disputeType]}</span></div>
                <div><span className="text-stone">Reported by:</span> <span className="text-navy font-medium ml-1">{selected.reportedByUser?.name} ({selected.reportedByUser?.role})</span></div>
                <div><span className="text-stone">Status:</span> <span className={`ml-1 inline-block text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[selected.dispute.status] || ''}`}>{selected.dispute.status.replace('_', ' ')}</span></div>
                <div><span className="text-stone">Description:</span> <span className="text-navy ml-1">{selected.dispute.description || 'N/A'}</span></div>
                <div><span className="text-stone">Fare:</span> <span className="text-navy font-mono ml-1">{selected.ride?.fare ? `${selected.ride.fare} PKR` : 'N/A'}</span></div>
                <div><span className="text-stone">Payment method:</span> <span className="text-navy capitalize ml-1">{selected.ride?.paymentMethod || 'N/A'}</span></div>
                <div><span className="text-stone">Payment status:</span> <span className="text-navy ml-1">{selected.ride?.paymentStatus || 'N/A'}</span></div>
                <div><span className="text-stone">Ride:</span> <span className="text-navy ml-1">{selected.ride ? `${selected.ride.pickupAddress || ''} → ${selected.ride.dropoffAddress || ''}` : 'N/A'}</span></div>
                {selected.passenger && (
                  <div className="border-t border-border pt-2 mt-1">
                    <p className="font-semibold text-navy mb-1">Passenger</p>
                    <div><span className="text-stone">Name:</span> <span className="text-navy ml-1">{selected.passenger.name}</span></div>
                    <div><span className="text-stone">Email:</span> <span className="text-navy ml-1">{selected.passenger.email}</span></div>
                    <div><span className="text-stone">Outstanding debt:</span> <span className="text-navy font-mono ml-1">{selected.passenger.outstandingDebt ? `${selected.passenger.outstandingDebt} PKR` : '0 PKR'}</span></div>
                    <div><span className="text-stone">Restriction:</span> <span className="text-navy ml-1">{selected.passenger.restriction || 'none'}</span></div>
                  </div>
                )}
              </div>

              {selected.dispute.status === 'open' || selected.dispute.status === 'under_review' ? (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                  <p className="text-sm font-semibold text-navy m-0">Admin Actions</p>
                  <button className="btn btn-success btn-sm w-full" disabled={resolving} onClick={() => resolve('approve_claim')}>
                    {resolving ? 'Processing...' : 'Approve Claim (adds debt to passenger)'}
                  </button>
                  <button className="btn btn-danger btn-sm w-full" disabled={resolving} onClick={() => resolve('add_debt')}>
                    {resolving ? 'Processing...' : 'Add Debt to Passenger'}
                  </button>
                  <button className="btn btn-secondary btn-sm w-full" disabled={resolving} onClick={() => resolve('reject_claim')}>
                    {resolving ? 'Processing...' : 'Reject Claim'}
                  </button>
                  <button className="btn btn-warning btn-sm w-full" disabled={resolving} onClick={() => resolve('escalate')}>
                    {resolving ? 'Processing...' : 'Escalate'}
                  </button>
                </div>
              ) : (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-stone"><span className="font-semibold">Resolution:</span> {selected.dispute.resolution || 'N/A'}</p>
                  {selected.dispute.adminNote && <p className="text-sm text-stone mt-1"><span className="font-semibold">Admin note:</span> {selected.dispute.adminNote}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDisputes;
