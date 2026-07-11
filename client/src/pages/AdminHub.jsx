import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import AdminVerification from './AdminVerification';
import AdminUsers from './AdminUsers';
import AdminRides from './AdminRides';
import AdminWallet from './AdminWallet';
import AdminPayments from './AdminPayments';
import AdminSOS from './AdminSOS';
import AdminDisputes from './AdminDisputes';
import AdminGeoFence from './AdminGeoFence';
import AdminActivity from './AdminActivity';

function AdminDashboardView() {
  const navigate = useNavigate();

  const quickLinks = [
    { to: '/admin/verifications', label: 'Verifications', icon: 'fileCheck', color: 'bg-[#FCE4EC] text-[#E91E8C]' },
    { to: '/admin/sos', label: 'SOS Alerts', icon: 'alert', color: 'bg-red-50 text-red-500' },
    { to: '/admin/geo-fence', label: 'Geo-Fence', icon: 'mapPin', color: 'bg-[#FCE4EC] text-[#E91E8C]' },
    { to: '/admin/users', label: 'Users', icon: 'users', color: 'bg-[#FCE4EC] text-[#E91E8C]' },
    { to: '/admin/rides', label: 'Rides', icon: 'car', color: 'bg-[#FCE4EC] text-[#E91E8C]' },
    { to: '/admin/payments', label: 'Payments', icon: 'creditCard', color: 'bg-[#FCE4EC] text-[#E91E8C]' },
    { to: '/admin/wallet', label: 'Wallets', icon: 'wallet', color: 'bg-[#FCE4EC] text-[#E91E8C]' },
    { to: '/admin/disputes', label: 'Disputes', icon: 'scale', color: 'bg-orange-50 text-orange-600' },
    { to: '/admin/activity', label: 'Activity', icon: 'clock', color: 'bg-[#FCE4EC] text-[#E91E8C]' },
  ];

  const LinkIcon = ({ name, className = 'w-6 h-6' }) => {
    const icons = {
      fileCheck: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 15l2 2 4-4" /></svg>,
      alert: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>,
      mapPin: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
      users: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
      car: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 17h14M5 12h14M5 7h14" /></svg>,
      creditCard: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>,
      wallet: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M16 12a2 2 0 114 0 2 2 0 01-4 0" /></svg>,
      scale: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-6" /><path d="M2 20h20" /></svg>,
      clock: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
    };
    return icons[name] || null;
  };

  return (
    <div className="p-5 lg:p-8  w-full">
      <p className="text-sm text-[#8B8B9E] m-0 mb-6">Select a section from the sidebar to manage the platform.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {quickLinks.map((link) => (
          <div
            key={link.to}
            onClick={() => navigate(link.to)}
            className="bg-white rounded-2xl border border-[#F0E0E8] p-5 hover:border-[#E91E8C] hover:shadow-sm transition cursor-pointer"
          >
            <div className={`w-11 h-11 rounded-full ${link.color.split(' ')[0]} flex items-center justify-center mb-3`}>
              <LinkIcon name={link.icon} className={`w-5 h-5 ${link.color.split(' ')[1]}`} />
            </div>
            <p className="text-sm font-bold text-[#1A1A1A] m-0">{link.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminHub() {
  return (
    <DashboardLayout
      views={{
        dashboard: { label: 'Dashboard', subtitle: 'Platform overview', icon: 'dashboard', component: AdminDashboardView },
        verifications: { label: 'Verifications', subtitle: 'Review driver documents', icon: 'fileCheck', component: AdminVerification },
        users: { label: 'Users', subtitle: 'Manage all accounts', icon: 'users', component: AdminUsers },
        rides: { label: 'Rides', subtitle: 'Monitor all rides', icon: 'car', component: AdminRides },
        wallets: { label: 'Wallets', subtitle: 'Driver wallets & withdrawals', icon: 'wallet', component: AdminWallet },
        payments: { label: 'Payments', subtitle: 'Revenue tracking', icon: 'creditCard', component: AdminPayments },
        sos: { label: 'SOS', subtitle: 'Emergency alerts', icon: 'alert', component: AdminSOS },
        disputes: { label: 'Disputes', subtitle: 'Open cases', icon: 'scale', component: AdminDisputes },
        geoFence: { label: 'Geo-Fence', subtitle: 'Service areas', icon: 'mapPin', component: AdminGeoFence },
        activity: { label: 'Activity', subtitle: 'System activity log', icon: 'clock', component: AdminActivity },
      }}
      defaultTab="dashboard"
    />
  );
}

export default AdminHub;
