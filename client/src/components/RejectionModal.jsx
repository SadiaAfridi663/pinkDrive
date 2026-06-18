import { useState } from 'react';

function RejectionModal({ onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-sm p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-display text-base font-semibold text-navy m-0 mb-1">Reason for Rejection</h4>
        <p className="text-sm text-stone m-0 mb-4">Explain which documents need changes and why.</p>
        <textarea
          className="input min-h-[100px] resize-vertical mb-4"
          placeholder="e.g. The license image is blurry. Please upload a clearer photo."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger flex-1" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default RejectionModal;
