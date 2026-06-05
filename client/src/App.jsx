import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Nav from './components/Nav';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import DriverVerification from './pages/DriverVerification';
import DriverDashboard from './pages/DriverDashboard';
import DriverRides from './pages/DriverRides';
import AdminDashboard from './pages/AdminDashboard';
import AdminVerification from './pages/AdminVerification';
import PassengerDashboard from './pages/PassengerDashboard';
import RequestRide from './pages/RequestRide';
import ActiveRide from './pages/ActiveRide';

function Home() {
  const { user } = useContext(AuthContext);
  if (!user) return null;
  if (user.role === 'passenger') return <Navigate to="/passenger" replace />;
  if (user.role === 'driver') return <Navigate to="/driver/dashboard" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return null;
}

function Layout({ children, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <Nav />
      {children}
    </ProtectedRoute>
  );
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/driver/verification" element={<Layout roles={['driver']}><DriverVerification /></Layout>} />
        <Route path="/driver/dashboard" element={<Layout roles={['driver']}><DriverDashboard /></Layout>} />
        <Route path="/driver/rides" element={<Layout roles={['driver']}><DriverRides /></Layout>} />
        <Route path="/admin" element={<Layout roles={['admin']}><AdminDashboard /></Layout>} />
        <Route path="/admin/verifications" element={<Layout roles={['admin']}><AdminVerification /></Layout>} />
        <Route path="/passenger" element={<Layout roles={['passenger']}><PassengerDashboard /></Layout>} />
        <Route path="/ride/request" element={<Layout roles={['passenger']}><RequestRide /></Layout>} />
        <Route path="/ride/active" element={<Layout roles={['passenger', 'driver']}><ActiveRide /></Layout>} />
        <Route path="/" element={<Layout><Home /></Layout>} />
      </Routes>
    </>
  );
}

export default App;
