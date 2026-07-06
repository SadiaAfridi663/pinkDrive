import { useState } from 'react';

function DeclineReasonModal({ isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(reason.trim());
    setReason('');
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#880E4F] m-0">Decline Request</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FFF8FA] text-[#8B8B9E] transition cursor-pointer border-none bg-transparent"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>

        <p className="text-sm text-[#8B8B9E] m-0 mb-4">
          Let the passenger know why you're declining this request.
        </p>

        <textarea
          placeholder="Enter reason for declining..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-[#F0E0E8] text-sm resize-none focus:outline-none focus:border-[#E91E8C] focus:ring-1 focus:ring-[#E91E8C] mb-5"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-[#F0E0E8] text-[#880E4F] font-bold hover:border-[#E91E8C] transition cursor-pointer bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition cursor-pointer border-none disabled:opacity-50"
          >
            {submitting ? 'Declining...' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeclineReasonModal;
