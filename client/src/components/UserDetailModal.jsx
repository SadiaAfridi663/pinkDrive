import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import ImagePreviewModal from './ImagePreviewModal';

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

const getFileUrl = (filePath) => {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  return `${API_URL}/${normalized}`;
};

function UserDetailModal({ user, documents, onClose, onSuspend }) {
  const overlayRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white rounded w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <h2 className="font-body text-base font-semibold text-plum m-0">User Details</h2>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer p-1 text-stone-light hover:text-charcoal transition" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3L15 15M15 3L3 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" src={getFileUrl(user.profilePhoto)} />
            <div className="min-w-0">
              <p className="font-display text-[1.15rem] font-semibold text-plum m-0 leading-snug truncate">{user.name}</p>
              <p className="text-[0.85rem] text-stone m-0 mt-0.5 truncate">{user.email}</p>
              <span className={`inline-block mt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.05em] px-2 py-0.5 rounded-sm ${user.role === 'admin' ? 'bg-[#fce4ec] text-pink' :
                  user.role === 'driver' ? 'bg-[#e3f2fd] text-[#1565c0]' :
                    'bg-[#f3e5f5] text-[#7b1fa2]'
                }`}>{user.role}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-ivory rounded-sm px-3.5 py-2.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-stone m-0 mb-0.5">Phone</p>
              <p className="text-[0.85rem] text-charcoal m-0 font-mono">{user.phone || '—'}</p>
            </div>
            <div className="bg-ivory rounded-sm px-3.5 py-2.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-stone m-0 mb-0.5">Joined</p>
              <p className="text-[0.85rem] text-charcoal m-0">{new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
            {user.lastActiveAt && (
              <div className="bg-ivory rounded-sm px-3.5 py-2.5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-stone m-0 mb-0.5">Last Active</p>
                <p className="text-[0.85rem] text-charcoal m-0">{new Date(user.lastActiveAt).toLocaleDateString()}</p>
              </div>
            )}
            {user.currentLat && user.currentLng && (
              <div className="bg-ivory rounded-sm px-3.5 py-2.5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-stone m-0 mb-0.5">Location</p>
                <p className="text-[0.85rem] text-charcoal m-0 font-mono">{user.currentLat.toFixed(4)}, {user.currentLng.toFixed(4)}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-stone m-0 mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              <span className={`inline-block text-[0.65rem] font-semibold px-2 py-1 rounded-sm ${user.isVerified ? 'bg-[#e8f5e9] text-success' : 'bg-[#fff8e1] text-warning'
                }`}>{user.isVerified ? 'Verified' : 'Unverified'}</span>
              <span className={`inline-block text-[0.65rem] font-semibold px-2 py-1 rounded-sm ${user.isSuspended ? 'bg-[#ffebee] text-error' : 'bg-[#e8f5e9] text-success'
                }`}>{user.isSuspended ? 'Suspended' : 'Active'}</span>
              {user.role === 'driver' && (
                <span className={`inline-block text-[0.65rem] font-semibold px-2 py-1 rounded-sm ${user.isDriverVerified ? 'bg-[#e8f5e9] text-success' : 'bg-[#fff8e1] text-warning'
                  }`}>{user.isDriverVerified ? 'Driver Verified' : 'Driver Pending'}</span>
              )}
            </div>
          </div>

          {documents.length > 0 && (
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-stone m-0 mb-2">Documents</p>
              <div className="flex flex-col gap-1.5">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between bg-ivory rounded-sm px-3.5 py-2.5">
                    <span className="text-[0.82rem] text-charcoal">
                      {doc.documentType === 'license' ? "Driver's License" :
                        doc.documentType === 'registration' ? 'Vehicle Registration' :
                          doc.documentType === 'profile_photo' ? 'Profile Photo' : doc.documentType}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[0.6rem] font-semibold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded-sm ${doc.status === 'approved' ? 'bg-[#e8f5e9] text-success' :
                          doc.status === 'rejected' ? 'bg-[#ffebee] text-error' :
                            'bg-[#fff8e1] text-warning'
                        }`}>{doc.status}</span>
                      <button onClick={() => setPreviewImage({ url: getFileUrl(doc.filePath), label: doc.documentType === 'license' ? "Driver's License" : doc.documentType === 'registration' ? 'Vehicle Registration' : 'Profile Photo' })} className="text-[0.7rem] text-pink no-underline font-medium hover:underline bg-transparent border-none cursor-pointer">View</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user.role !== 'admin' && (
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 bg-transparent border-2 border-border text-stone hover:border-pink hover:text-pink inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm rounded-sm px-4 py-2 cursor-pointer transition">
                Close
              </button>
              <button
                onClick={() => onSuspend(user.id, user.name)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-2 rounded-sm px-4 py-2 cursor-pointer transition ${user.isSuspended
                    ? 'bg-transparent border-success text-success hover:bg-[#e8f5e9]'
                    : 'bg-transparent border-error text-error hover:bg-[#ffebee]'
                  }`}
              >
                {user.isSuspended ? 'Activate' : 'Suspend'}
              </button>
            </div>
          )}
        </div>
      </div>

      {previewImage && (
        <ImagePreviewModal
          images={[previewImage]}
          currentIndex={0}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}

export default UserDetailModal;
