import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';

const STATES = {
  not_submitted: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#FCE4EC" />
        <path d="M14 22L20 16L26 22" stroke="#E91E8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 16V28" stroke="#E91E8C" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Get started',
    desc: 'Upload your documents to begin the verification process.',
    action: 'Upload Documents',
    path: '/driver/verification',
  },
  pending: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#FFF8E1" />
        <circle cx="20" cy="20" r="6" stroke="#E67E22" strokeWidth="2" />
        <path d="M20 17V20L22 22" stroke="#E67E22" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Under review',
    desc: 'Your documents are being reviewed. We will notify you once verified.',
    action: null,
    path: null,
  },
  rejected: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#FFEBEE" />
        <path d="M15 15L25 25M25 15L15 25" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Changes needed',
    desc: 'Some documents were not approved. Check feedback and re-upload.',
    action: 'Re-upload',
    path: '/driver/verification',
  },
  approved: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#E8F5E9" />
        <path d="M14 20L18 24L26 16" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'You are verified!',
    desc: 'All documents approved. You can now accept rides.',
    action: 'View Rides',
    path: '/driver/rides',
  },
};

function DriverDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await driverAPI.getStatus();
        if (mounted) setData(res.data.data);
      } catch {
        if (mounted) setData({ status: 'not_submitted', documents: [], isDriverVerified: false });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    return () => { mounted = false; };
  }, []);

  if (loading) return (
    <div className="max-w-[500px] mx-auto px-6 py-12">
      <div className="loading-skeleton h-6 w-1/3 mb-6" />
      <div className="loading-skeleton h-36 rounded" />
    </div>
  );

  const s = STATES[data?.status] || STATES.not_submitted;

  return (
    <div className="max-w-[500px] mx-auto px-6 py-10">
      <h1 className="font-display text-[1.5rem] font-bold text-plum tracking-[-0.02em] m-0 mb-8">Driver Dashboard</h1>

      <div className="bg-white border border-border rounded p-6">
        <div className="flex items-start gap-4">
          {s.icon}
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-[1.15rem] font-semibold text-plum m-0 mb-1.5 leading-snug">{s.title}</h2>
            <p className="text-[0.85rem] text-stone m-0 mb-4 leading-[1.5]">{s.desc}</p>
            {s.action && (
              <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-4 py-2 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)]" onClick={() => navigate(s.path)}>
                {s.action}
              </button>
            )}
          </div>
        </div>
      </div>

      {data?.documents?.length > 0 && (
        <div className="mt-6">
          <h3 className="font-body text-xs font-semibold uppercase tracking-[0.08em] text-stone m-0 mb-3">Documents</h3>
          <div className="flex flex-col gap-1.5">
            {data.documents.map((doc) => (
              <div key={doc.id} className="bg-white border border-border rounded-sm px-4 py-3 flex items-center justify-between">
                <span className="text-[0.85rem] text-charcoal">
                  {doc.documentType === 'license' ? "Driver's License" : doc.documentType === 'registration' ? 'Vehicle Registration' : 'Profile Photo'}
                </span>
                <span className={`text-[0.7rem] font-semibold uppercase tracking-[0.05em] px-2 py-0.5 rounded-sm ${
                  doc.status === 'approved' ? 'bg-[#e8f5e9] text-success' :
                  doc.status === 'rejected' ? 'bg-[#ffebee] text-error' :
                  'bg-[#fff8e1] text-warning'
                }`}>{doc.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverDashboard;
