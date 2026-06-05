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
    <nav className="nav">
      <Link to="/" className="nav-brand">PinkDrive</Link>
      <div className="nav-links">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="nav-link">{l.label}</Link>
        ))}
        <span className="nav-user">{user.name}</span>
        <button className="nav-logout" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}

export default Nav;
