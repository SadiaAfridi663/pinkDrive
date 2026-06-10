import { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function Nav() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const links = user.role === 'passenger'
    ? [
        { to: '/passenger', label: 'Dashboard' },
        { to: '/ride/request', label: 'New Ride' },
        { to: '/emergency-contacts', label: 'Emergency' },
      ]
    : user.role === 'driver'
      ? [
          { to: '/driver/dashboard', label: 'Dashboard' },
          { to: '/driver/rides', label: 'Rides' },
          { to: '/driver/verification', label: 'Documents' },
        ]
      : [
          { to: '/admin', label: 'Dashboard' },
          { to: '/admin/verifications', label: 'Verifications' },
          { to: '/admin/users', label: 'Users' },
          { to: '/admin/rides', label: 'Rides' },
          { to: '/admin/sos', label: 'SOS' },
          { to: '/admin/geo-fence', label: 'Geo-Fence' },
          { to: '/admin/activity', label: 'Activity' },
        ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-[100] bg-navy">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between h-14 px-5">
        <Link to="/" className="font-display text-[1.25rem] font-bold text-coral no-underline tracking-[-0.01em] leading-none">
          PinkDrive
        </Link>

        <div className="hidden md:flex items-center gap-0.5">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-medium no-underline px-3 py-1.5 rounded-sm transition ${
                location.pathname === l.to
                  ? 'text-white bg-white/10'
                  : 'text-white/70 hover:text-white hover:bg-white/8'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <span className="text-xs text-white/40 px-2 ml-1">{user.name}</span>
          <button className="btn btn-outline-dark btn-sm ml-1" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <button className="md:hidden flex items-center justify-center w-9 h-9 rounded-sm text-white/70 hover:text-white hover:bg-white/8 transition" onClick={() => setOpen(!open)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {open ? (
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <>
                <path d="M3 5H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 10H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-navy-light border-t border-white/10 px-5 pb-4 pt-2 flex flex-col gap-0.5">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-medium no-underline px-3 py-2 rounded-sm transition ${
                location.pathname === l.to ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/8'
              }`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
            <span className="text-xs text-white/40">{user.name}</span>
            <button className="btn btn-outline-dark btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Nav;
