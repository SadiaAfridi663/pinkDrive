import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const NAV_ITEMS = {
  passenger: [
    { to: '/passenger', label: 'Dashboard', icon: 'dashboard' },
    { to: '/ride/request', label: 'Book a Ride', icon: 'carPlus' },
    { to: '/wallet', label: 'Wallet', icon: 'wallet' },
    { to: '/emergency-contacts', label: 'Emergency', icon: 'shield' },
  ],
  driver: [
    { to: '/driver/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/driver/rides', label: 'Rides', icon: 'car' },
    { to: '/wallet', label: 'Wallet', icon: 'wallet' },
    { to: '/wallet/earnings', label: 'Earnings', icon: 'chart' },
    { to: '/wallet/withdraw', label: 'Withdraw', icon: 'walletArrow' },
    { to: '/driver/verification', label: 'Documents', icon: 'fileCheck' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { to: '/admin/verifications', label: 'Verifications', icon: 'fileCheck' },
    { to: '/admin/users', label: 'Users', icon: 'users' },
    { to: '/admin/rides', label: 'Rides', icon: 'car' },
    { to: '/admin/wallet', label: 'Wallets', icon: 'wallet' },
    { to: '/admin/payments', label: 'Payments', icon: 'creditCard' },
    { to: '/admin/sos', label: 'SOS', icon: 'alert' },
    { to: '/admin/disputes', label: 'Disputes', icon: 'scale' },
    { to: '/admin/geo-fence', label: 'Geo-Fence', icon: 'mapPin' },
    { to: '/admin/activity', label: 'Activity', icon: 'clock' },
  ],
};

function Icon({ name, className = 'w-5 h-5' }) {
  const svgs = {
    dashboard: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
    carPlus: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14l2-5h14l2 5" /><path d="M5 14v3a1 1 0 001 1h2a1 1 0 001-1v-1" /><path d="M15 17a1 1 0 001 1h2a1 1 0 001-1v-1" /><path d="M18 9V7" /><path d="M16 8h4" /></svg>,
    clock: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
    wallet: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M16 12a2 2 0 114 0 2 2 0 01-4 0" /></svg>,
    shield: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    car: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M5 12h14M5 7h14" /></svg>,
    chart: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>,
    walletArrow: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M16 12a2 2 0 114 0 2 2 0 01-4 0" /><path d="M9 12h2m0 0h2m-2 0V9m0 3v3" /></svg>,
    fileCheck: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 15l2 2 4-4" /></svg>,
    users: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
    creditCard: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>,
    alert: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>,
    scale: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-6" /><path d="M2 20h20" /></svg>,
    mapPin: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    logout: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>,
    menu: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>,
    close: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>,
    bell: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
    search: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>,
  };
  return svgs[name] || null;
}

const BADGE_MAP = {
  '/admin/verifications': 'verifications',
  '/admin/sos': 'sos',
  '/admin/disputes': 'disputes',
  '/driver/rides': 'availableRides',
  '/passenger': 'activeRide',
};

function DashboardLayout({ views, defaultTab, children, title, subtitle }) {
  const { user, logout } = useContext(AuthContext);
  const { counts } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isTabMode = !!views;

  const [activeTab, setActiveTab] = useState(defaultTab || (isTabMode ? Object.keys(views)[0] : null));
  useEffect(() => {
    if (defaultTab && views?.[defaultTab]) setActiveTab(defaultTab);
  }, [defaultTab, views]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const role = user?.role || 'passenger';
  const navItems = isTabMode
    ? Object.entries(views).map(([key, v]) => ({ key, label: v.label, icon: v.icon, to: key }))
    : NAV_ITEMS[role] || [];

  const activeView = isTabMode ? views?.[activeTab] : null;
  const ActiveComponent = activeView?.component;

  const isActive = (path) => {
    if (isTabMode) return activeTab === path;
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const headerTitle = isTabMode ? (activeView?.label || 'Dashboard') : (title || '');
  const headerSubtitle = isTabMode ? (activeView?.subtitle || '') : (subtitle || '');

  return (
    <div className="min-h-screen bg-[#FFF8FA] flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#F0E0E8] flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-[#F0E0E8] flex-shrink-0">
          {isTabMode ? (
            <span className="font-display text-[1.35rem] font-bold text-[#E91E8C] tracking-tight leading-none">PinkDrive</span>
          ) : (
            <Link to="/" className="font-display text-[1.35rem] font-bold text-[#E91E8C] tracking-tight leading-none no-underline">PinkDrive</Link>
          )}
          <button
            className="lg:hidden w-8 h-8 flex items-center justify-center text-[#8B8B9E] hover:text-[#1A1A1A] rounded-lg hover:bg-[#FFF8FA] transition cursor-pointer border-none bg-transparent"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const badgeKey = BADGE_MAP[item.to];
            const badgeCount = badgeKey ? counts[badgeKey] : 0;
            const active = isActive(item.to);

            if (isTabMode) {
              return (
                <button
                  key={item.to}
                  onClick={() => { setActiveTab(item.to); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition cursor-pointer border-none ${active ? 'bg-[#FCE4EC] text-[#E91E8C]' : 'text-[#8B8B9E] hover:text-[#1A1A1A] hover:bg-[#FFF8FA]'
                    }`}
                >
                  <Icon name={item.icon} className={`w-5 h-5 flex-shrink-0 ${active ? 'text-[#E91E8C]' : ''}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold leading-none rounded-full bg-[#E91E8C] text-white">{badgeCount > 99 ? '99+' : badgeCount}</span>
                  )}
                </button>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition ${active ? 'bg-[#FCE4EC] text-[#E91E8C]' : 'text-[#8B8B9E] hover:text-[#1A1A1A] hover:bg-[#FFF8FA]'
                  }`}
              >
                <Icon name={item.icon} className={`w-5 h-5 flex-shrink-0 ${active ? 'text-[#E91E8C]' : ''}`} />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold leading-none rounded-full bg-[#E91E8C] text-white">{badgeCount > 99 ? '99+' : badgeCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#F0E0E8] p-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#FCE4EC] flex items-center justify-center text-sm font-bold text-[#E91E8C] flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1A1A] m-0 truncate">{user?.name || 'User'}</p>
              <p className="text-[0.65rem] text-[#8B8B9E] m-0 truncate capitalize">{user?.role || ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-[#D32F2F] hover:bg-red-50 transition cursor-pointer border-none bg-transparent"
          >
            <Icon name="logout" className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-[#F0E0E8] h-16 flex-shrink-0">
          <div className="flex items-center justify-between h-full px-5 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden w-9 h-9 flex items-center justify-center text-[#8B8B9E] hover:text-[#1A1A1A] rounded-lg hover:bg-[#FFF8FA] transition cursor-pointer border-none bg-transparent"
                onClick={() => setSidebarOpen(true)}
              >
                <Icon name="menu" className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-[#880E4F] m-0 leading-tight hidden sm:block">{headerTitle}</h1>
                {headerSubtitle && <p className="text-xs text-[#8B8B9E] m-0 hidden sm:block">{headerSubtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="relative w-9 h-9 flex items-center justify-center text-[#8B8B9E] hover:text-[#1A1A1A] hover:bg-[#FFF8FA] rounded-lg transition cursor-pointer border-none bg-transparent">
                <Icon name="bell" className="w-5 h-5" />
                {Object.values(counts).some(c => c > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E91E8C]" />
                )}
              </button>
              <div className="w-8 h-8 rounded-full bg-[#FCE4EC] flex items-center justify-center text-xs font-bold text-[#E91E8C] lg:hidden">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 relative flex flex-col items-center justify-center">
          {isTabMode ? (ActiveComponent ? <ActiveComponent /> : null) : children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
