import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';

const STATUS_META = {
  not_submitted: {
    label: 'Not Started',
    icon: '📋',
    heading: 'Verification not started',
    body: "You haven't uploaded any documents yet. Submit your license, vehicle registration, and profile photo to start driving.",
    cta: 'Upload Documents',
    path: '/driver/verification',
    theme: 'neutral',
  },
  pending: {
    label: 'Under Review',
    icon: '⏳',
    heading: 'Documents under review',
    body: 'Your documents have been submitted and are being reviewed by our team. This usually takes 1–2 business days. We will notify you once the review is complete.',
    cta: 'View Documents',
    path: null,
    theme: 'pending',
  },
  rejected: {
    label: 'Changes Needed',
    icon: '📝',
    heading: 'Documents need changes',
    body: 'Some of your documents were not approved. Check the admin feedback below, remove the rejected files, and upload corrected versions.',
    cta: 'Re-upload Documents',
    path: '/driver/verification',
    theme: 'rejected',
  },
  approved: {
    label: 'Verified',
    icon: '✅',
    heading: 'You are verified!',
    body: 'All your documents have been approved. You can now accept ride requests and start earning. Head to the ride requests page to see available rides.',
    cta: 'View Ride Requests',
    path: '/driver/rides',
    theme: 'approved',
  },
};

const STATUS_THEMES = {
  neutral: 'border-l-border',
  pending: 'border-l-warning bg-[#fffef5]',
  rejected: 'border-l-error bg-[#fff8f8]',
  approved: 'border-l-success bg-[#f6fdf6]',
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

  const badgeClass = (status) => {
    const base = 'inline-block text-xs font-semibold uppercase tracking-[0.05em] px-2 py-1 rounded';
    const colors = {
      approved: 'bg-[#e8f5e9] text-success',
      rejected: 'bg-[#ffebee] text-error',
      pending: 'bg-[#fff8e1] text-warning',
      accepted: 'bg-[#e3f2fd] text-[#1565c0]',
      arrived: 'bg-[#e3f2fd] text-[#1565c0]',
      in_progress: 'bg-[#f3e5f5] text-[#7b1fa2]',
      completed: 'bg-[#e8f5e9] text-success',
      cancelled: 'bg-[#f5f5f5] text-text-light',
    };
    return `${base} ${colors[status] || colors.pending}`;
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;

  const meta = STATUS_META[data?.status] || STATUS_META.not_submitted;

  return (
    <div className="max-w-page mx-auto px-6 py-8 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-[2.2rem] font-bold text-plum tracking-[-0.02em] leading-[1.15] m-0">Driver</h1>
        <p className="text-[0.95rem] text-text-muted mt-1 m-0">Verification Status</p>
      </div>

      <div className={`flex gap-5 p-6 rounded border border-border bg-white border-l-4 ${STATUS_THEMES[meta.theme] || STATUS_THEMES.neutral}`}>
        <div className="text-3xl leading-none">{meta.icon}</div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted m-0 mb-1">{meta.label}</p>
          <h2 className="font-display text-[1.2rem] font-semibold text-plum m-0 mb-2 leading-[1.3]">{meta.heading}</h2>
          <p className="text-[0.9rem] text-text-muted m-0 mb-4 leading-[1.6]">{meta.body}</p>
          {meta.path && (
            <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" onClick={() => navigate(meta.path)}>
              {meta.cta}
            </button>
          )}
        </div>
      </div>

      {data?.documents?.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-plum mb-3 tracking-[-0.01em] m-0">Documents</h3>
          <div className="flex flex-col gap-2">
            {data.documents.map((doc) => {
              const statusBorder = doc.status === 'approved' ? 'border-l-success' : doc.status === 'rejected' ? 'border-l-error' : doc.status === 'pending' ? 'border-l-warning' : 'border-l-border';
              return (
                <div key={doc.id} className={`bg-white border border-border rounded-sm px-4 py-3.5 border-l-[3px] ${statusBorder}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-plum">
                      {doc.documentType === 'license' && "Driver's License"}
                      {doc.documentType === 'registration' && 'Vehicle Registration'}
                      {doc.documentType === 'profile_photo' && 'Profile Photo'}
                    </span>
                    <span className={badgeClass(doc.status)}>{doc.status}</span>
                  </div>
                  {doc.adminNote && <p className="text-xs text-text-muted italic mt-1.5 m-0">{doc.adminNote}</p>}
                  {doc.status === 'rejected' && (
                    <button
                      className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-xs border-2 border-border rounded-sm px-3.5 py-1.5 cursor-pointer transition no-underline bg-transparent text-text-muted hover:border-pink hover:text-pink mt-2"
                      onClick={async () => {
                        await driverAPI.removeDocument(doc.id);
                        const res = await driverAPI.getStatus();
                        setData(res.data.data);
                      }}
                    >
                      Remove & Re-upload
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data?.status === 'rejected' && (
        <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none w-full" onClick={() => navigate('/driver/verification')}>
          Re-upload Documents
        </button>
      )}

      {data?.status === 'approved' && (
        <button className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none w-full" onClick={() => navigate('/driver/rides')}>
          Go to Ride Requests
        </button>
      )}
    </div>
  );
}

export default DriverDashboard;
