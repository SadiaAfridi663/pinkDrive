import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAPI, walletAPI } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import DriverRides from './DriverRides';
import DriverEarnings from './DriverEarnings';
import DriverWithdraw from './DriverWithdraw';
import DriverVerification from './DriverVerification';

const StatusIcon = ({ name, className = 'w-7 h-7' }) => {
  const icons = {
    clipboard: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 13l2 2 4-4" /></svg>,
    clock: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
    fileEdit: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M12 18l-3-3 1.5-1.5" /></svg>,
    checkCircle: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>,
  };
  return icons[name] || null;
};

function DashboardView() {
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const [verRes, walRes] = await Promise.all([
          driverAPI.getStatus(),
          walletAPI.getWithdrawable().catch(() => null),
        ]);
        if (mounted) { setData(verRes.data.data); setWallet(walRes?.data?.data || null); }
      } catch {
        if (mounted) setData({ status: 'not_submitted', documents: [], isDriverVerified: false });
      } finally { if (mounted) setLoading(false); }
    };
    fetch();
    return () => { mounted = false; };
  }, []);

  const STATES = {
    not_submitted: { icon: 'clipboard', title: 'Get verified to start earning', desc: 'Upload your documents and complete the verification process to start accepting rides.', action: 'Upload Documents', path: '/driver/verification' },
    pending: { icon: 'clock', title: 'Under review', desc: 'Your documents are being reviewed. We will notify you once you\'re verified.', action: null, path: null },
    rejected: { icon: 'fileEdit', title: 'Changes needed', desc: 'Some documents were not approved. Check the feedback and re-upload.', action: 'Re-upload', path: '/driver/verification' },
    approved: { icon: 'checkCircle', title: 'You\'re verified!', desc: 'All documents approved. You can now accept rides and start earning.', action: 'Find Rides', path: '/driver/rides' },
  };

  if (loading) return <div className="p-5 lg:p-8 animate-pulse space-y-4 max-w-4xl"><div className="h-8 bg-gray-200 rounded-lg w-1/2" /><div className="h-48 bg-gray-200 rounded-2xl" /></div>;

  const s = STATES[data?.status] || STATES.not_submitted;
  const isVerified = data?.status === 'approved';

  return (
    <div className="p-5 lg:p-8 max-w-4xl w-full">
      {!isVerified && (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] p-6 lg:p-7 mb-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[#FCE4EC] flex items-center justify-center flex-shrink-0">
              <StatusIcon name={s.icon} className="w-7 h-7 text-[#E91E8C]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[#880E4F] m-0 mb-1">{s.title}</h2>
              <p className="text-sm text-[#8B8B9E] m-0 mb-4 leading-relaxed">{s.desc}</p>
              {s.action && <button className="bg-[#E91E8C] text-white font-bold text-sm py-2.5 px-6 rounded-xl hover:bg-[#C2185B] transition cursor-pointer border-none" onClick={() => navigate(s.path)}>{s.action}</button>}
            </div>
          </div>
          {data?.documents?.length > 0 && (
            <div className="mt-5 pt-5 border-t border-[#F0E0E8]">
              <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-3">Documents</p>
              <div className="space-y-2">
                {data.documents.map((doc) => (
                  <div key={doc.id}>
                    <div className="flex items-center justify-between py-2.5 px-4 bg-[#FFF8FA] rounded-xl">
                      <span className="text-sm font-medium text-[#1A1A1A]">{doc.documentType === 'license' ? "Driver's License" : doc.documentType === 'registration' ? 'Vehicle Registration' : 'Profile Photo'}</span>
                      <span className={`text-[0.55rem] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : doc.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{doc.status}</span>
                    </div>
                    {doc.status === 'rejected' && doc.adminNote && <p className="text-xs text-red-500 m-0 mt-0.5 px-4">{doc.adminNote}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {wallet && isVerified && (
        <div className="bg-white rounded-2xl border border-[#F0E0E8] overflow-hidden shadow-sm mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {isVerified && (
                  <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[0.55rem] font-bold text-emerald-700 uppercase tracking-wider">Online</span>
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="bg-[#FFF8FA] rounded-xl p-5">
                <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Wallet Balance</p>
                <p className="text-2xl font-bold text-emerald-700 m-0 font-mono">{wallet.walletBalance.toFixed(0)} PKR</p>
              </div>
              <div className="bg-[#FFF8FA] rounded-xl p-5">
                <p className="text-[0.6rem] font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-1">Total Earnings</p>
                <p className="text-2xl font-bold text-[#880E4F] m-0 font-mono">{wallet.totalEarnings.toFixed(0)} PKR</p>
              </div>
            </div>
            <div className="space-y-3">
              {parseFloat(wallet.commissionDue) > 0 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    <span className="text-xs font-semibold text-amber-700">Commission Due</span>
                  </div>
                  <span className="text-sm font-bold text-amber-700 font-mono">{wallet.commissionDue.toFixed(0)} PKR</span>
                </div>
              )}
              <div className="flex items-center justify-between px-1 py-2">
                <span className="text-xs text-[#8B8B9E]">Withdrawable</span>
                <span className="text-sm font-bold text-[#1A1A1A] font-mono">{wallet.withdrawable.toFixed(0)} PKR</span>
              </div>
              <div className="flex items-center justify-between px-1 py-2 border-t border-[#F0E0E8]">
                <span className="text-xs text-[#8B8B9E]">Total Withdrawn</span>
                <span className="text-sm font-bold text-[#1A1A1A] font-mono">{wallet.totalWithdrawn.toFixed(0)} PKR</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isVerified && (
        <>
          <h3 className="text-xs font-bold text-[#8B8B9E] uppercase tracking-wider m-0 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => navigate('/driver/rides')} className="bg-white rounded-2xl border border-[#F0E0E8] p-6 text-left hover:border-[#E91E8C] hover:shadow-sm transition cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-[#FCE4EC] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#E91E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 17h14M5 12h14M5 7h14" /></svg>
              </div>
              <p className="text-base font-bold text-[#1A1A1A] m-0">Rides</p>
              <p className="text-sm text-[#8B8B9E] m-0 mt-0.5">Accept and manage ride requests</p>
            </button>
            <button onClick={() => navigate('/driver/verification')} className="bg-white rounded-2xl border border-[#F0E0E8] p-6 text-left hover:border-[#E91E8C] hover:shadow-sm transition cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-[#FCE4EC] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#E91E8C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 15l2 2 4-4" /></svg>
              </div>
              <p className="text-base font-bold text-[#1A1A1A] m-0">Verification</p>
              <p className="text-sm text-[#8B8B9E] m-0 mt-0.5">{isVerified ? 'All documents verified' : 'Documents pending'}</p>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DriverHub() {
  const [verData, setVerData] = useState(null);
  useEffect(() => {
    driverAPI.getStatus().then(r => setVerData(r.data.data)).catch(() => setVerData({ status: 'not_submitted', isDriverVerified: false }));
  }, []);
  const isVerified = verData?.status === 'approved';

  const baseViews = {
    dashboard: { label: 'Dashboard', subtitle: 'Earnings at a glance', icon: 'dashboard', component: DashboardView },
    documents: { label: 'Documents', subtitle: 'Verification documents', icon: 'fileCheck', component: DriverVerification },
  };

  const verifiedViews = {
    rides: { label: 'Rides', subtitle: 'Accept and manage rides', icon: 'car', component: DriverRides },
    earnings: { label: 'Earnings', subtitle: 'Track your revenue', icon: 'chart', component: DriverEarnings },
    withdraw: { label: 'Withdraw', subtitle: 'Request a payout', icon: 'walletArrow', component: DriverWithdraw },
  };

  return (
    <DashboardLayout
      views={{ ...baseViews, ...(isVerified ? verifiedViews : {}) }}
      defaultTab="dashboard"
    />
  );
}

export default DriverHub;
