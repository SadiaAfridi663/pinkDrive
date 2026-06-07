import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function ProtectedRoute({ children, roles }) {
  const { user, loading, isAuthenticated } = useContext(AuthContext);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-text-light text-sm">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
