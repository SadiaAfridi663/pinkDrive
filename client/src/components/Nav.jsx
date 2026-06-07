import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function Nav() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const links = user.role === 'passenger'
    ? [
        { to: '/passenger', label: 'Dashboard' },
        { to: '/ride/request', label: 'New Ride' },
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
        ];

  return (
    <nav className="flex items-center justify-between px-6 h-[60px] bg-white border-b border-border sticky top-0 z-[100]">
      <Link to="/" className="font-display text-[1.3rem] font-bold text-pink no-underline tracking-[-0.02em]">PinkDrive</Link>
      <div className="flex items-center gap-2">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="text-sm font-medium text-text-muted no-underline px-3 py-1.5 rounded-sm hover:text-pink hover:bg-pink-subtle transition">{l.label}</Link>
        ))}
        <span className="text-xs text-text-muted px-2">{user.name}</span>
        <button className="bg-none border border-border rounded-sm px-3 py-1 font-body text-xs text-text-muted cursor-pointer hover:border-error hover:text-error hover:bg-[#fff5f5] transition" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}

export default Nav;
