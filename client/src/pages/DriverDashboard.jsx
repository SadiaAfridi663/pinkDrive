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

  if (loading) return <div className="loading">Loading...</div>;

  const meta = STATUS_META[data?.status] || STATUS_META.not_submitted;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Driver</h1>
        <p className="page-subtitle">Verification Status</p>
      </div>

      <div className={`status-card status-card--${meta.theme}`}>
        <div className="status-card-icon">{meta.icon}</div>
        <div className="status-card-body">
          <p className="status-card-label">{meta.label}</p>
          <h2 className="status-card-heading">{meta.heading}</h2>
          <p className="status-card-message">{meta.body}</p>
          {meta.path && (
            <button className="btn btn-primary" onClick={() => navigate(meta.path)}>
              {meta.cta}
            </button>
          )}
        </div>
      </div>

      {data?.documents?.length > 0 && (
        <div className="section">
          <h3 className="section-title">Documents</h3>
          <div className="doc-group">
            {data.documents.map((doc) => (
              <div key={doc.id} className={`doc-card doc-card--${doc.status}`}>
                <div className="doc-card-top">
                  <span className="doc-card-name">
                    {doc.documentType === 'license' && "Driver's License"}
                    {doc.documentType === 'registration' && 'Vehicle Registration'}
                    {doc.documentType === 'profile_photo' && 'Profile Photo'}
                  </span>
                  <span className={`badge badge--${doc.status}`}>{doc.status}</span>
                </div>
                {doc.adminNote && <p className="doc-card-note">{doc.adminNote}</p>}
                {doc.status === 'rejected' && (
                  <button
                    className="btn btn-sm btn-outline"
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
            ))}
          </div>
        </div>
      )}

      {data?.status === 'rejected' && (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/driver/verification')}>
          Re-upload Documents
        </button>
      )}

      {data?.status === 'approved' && (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/driver/rides')}>
          Go to Ride Requests
        </button>
      )}
    </div>
  );
}

export default DriverDashboard;
