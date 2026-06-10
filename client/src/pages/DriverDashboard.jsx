import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';

const STATUS_META = {
  not_submitted: { label: 'Not Started', icon: '📋', heading: 'Verification not started', body: "You haven't uploaded any documents yet. Submit your license, vehicle registration, and profile photo to start driving.", cta: 'Upload Documents', path: '/driver/verification', theme: 'neutral' },
  pending: { label: 'Under Review', icon: '⏳', heading: 'Documents under review', body: 'Your documents have been submitted and are being reviewed by our team. This usually takes 1–2 business days.', cta: 'View Documents', path: null, theme: 'pending' },
  rejected: { label: 'Changes Needed', icon: '📝', heading: 'Documents need changes', body: 'Some of your documents were not approved. Check the admin feedback below, remove the rejected files, and upload corrected versions.', cta: 'Re-upload Documents', path: '/driver/verification', theme: 'rejected' },
  approved: { label: 'Verified', icon: '✅', heading: 'You are verified!', body: 'All your documents have been approved. You can now accept ride requests and start earning.', cta: 'View Ride Requests', path: '/driver/rides', theme: 'approved' },
};

const STATUS_BORDER = { neutral: 'border-l-border', pending: 'border-l-warning bg-[#fffef5]', rejected: 'border-l-error bg-[#fff8f8]', approved: 'border-l-success bg-[#f6fdf6]' };

const badgeClass = (status) => {
  const colors = {
    approved: 'badge-success', rejected: 'badge-error', pending: 'badge-warning',
    accepted: 'badge-info', arrived: 'badge-info', in_progress: 'badge-info',
    completed: 'badge-success', cancelled: 'badge-neutral',
  };
  return `badge ${colors[status] || 'badge-warning'}`;
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

  if (loading) return <div className="page"><div className="space-y-3"><div className="loading-skeleton h-8 w-1/3" /><div className="loading-skeleton h-4 w-2/3" /><div className="loading-skeleton h-32" /></div></div>;

  const meta = STATUS_META[data?.status] || STATUS_META.not_submitted;

  return (
    <div className="page">
      <div className="page-header page-header-accent">
        <h1>Driver Dashboard</h1>
        <p>Verification status</p>
      </div>

      <div className={`flex gap-5 p-6 rounded border border-border bg-white border-l-4 ${STATUS_BORDER[meta.theme] || STATUS_BORDER.neutral}`}>
        <div className="text-3xl leading-none">{meta.icon}</div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone m-0 mb-1">{meta.label}</p>
          <h2 className="font-display text-[1.2rem] font-semibold text-navy m-0 mb-2 leading-[1.3]">{meta.heading}</h2>
          <p className="text-[0.9rem] text-stone m-0 mb-4 leading-[1.6]">{meta.body}</p>
          {meta.path && (
            <button className="btn btn-primary" onClick={() => navigate(meta.path)}>{meta.cta}</button>
          )}
        </div>
      </div>

      {data?.documents?.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold text-navy mb-3 tracking-[-0.01em] m-0">Documents</h3>
          <div className="flex flex-col gap-2">
            {data.documents.map((doc) => {
              const border = doc.status === 'approved' ? 'border-l-success' : doc.status === 'rejected' ? 'border-l-error' : doc.status === 'pending' ? 'border-l-warning' : 'border-l-border';
              return (
                <div key={doc.id} className={`bg-white border border-border rounded-sm px-4 py-3.5 border-l-[3px] ${border}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-navy">{doc.documentType === 'license' ? "Driver's License" : doc.documentType === 'registration' ? 'Vehicle Registration' : 'Profile Photo'}</span>
                    <span className={badgeClass(doc.status)}>{doc.status}</span>
                  </div>
                  {doc.adminNote && <p className="text-xs text-stone italic mt-1.5 m-0">{doc.adminNote}</p>}
                  {doc.status === 'rejected' && (
                    <button className="btn btn-secondary btn-sm mt-2" onClick={async () => { await driverAPI.removeDocument(doc.id); const r = await driverAPI.getStatus(); setData(r.data.data); }}>
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
        <button className="btn btn-primary btn-full mt-4" onClick={() => navigate('/driver/verification')}>Re-upload Documents</button>
      )}
      {data?.status === 'approved' && (
        <button className="btn btn-primary btn-full mt-4" onClick={() => navigate('/driver/rides')}>Go to Ride Requests</button>
      )}
    </div>
  );
}

export default DriverDashboard;
