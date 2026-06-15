import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
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
import AdminGeoFence from './pages/AdminGeoFence';
import AdminSOS from './pages/AdminSOS';
import AdminUsers from './pages/AdminUsers';
import AdminRides from './pages/AdminRides';
import AdminRideDetail from './pages/AdminRideDetail';
import AdminActivity from './pages/AdminActivity';
import EmergencyContacts from './pages/EmergencyContacts';
import PassengerDashboard from './pages/PassengerDashboard';
import RequestRide from './pages/RequestRide';
import ActiveRide from './pages/ActiveRide';
import RideDetail from './pages/RideDetail';
import PaymentCheckout from './pages/PaymentCheckout';

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
    <SocketProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/driver/verification" element={<Layout roles={['driver']}><DriverVerification /></Layout>} />
          <Route path="/driver/dashboard" element={<Layout roles={['driver']}><DriverDashboard /></Layout>} />
          <Route path="/driver/rides" element={<Layout roles={['driver']}><DriverRides /></Layout>} />
          <Route path="/admin" element={<Layout roles={['admin']}><AdminDashboard /></Layout>} />
          <Route path="/admin/verifications" element={<Layout roles={['admin']}><AdminVerification /></Layout>} />
          <Route path="/admin/geo-fence" element={<Layout roles={['admin']}><AdminGeoFence /></Layout>} />
          <Route path="/admin/sos" element={<Layout roles={['admin']}><AdminSOS /></Layout>} />
          <Route path="/admin/users" element={<Layout roles={['admin']}><AdminUsers /></Layout>} />
          <Route path="/admin/rides" element={<Layout roles={['admin']}><AdminRides /></Layout>} />
          <Route path="/admin/rides/:id" element={<Layout roles={['admin']}><AdminRideDetail /></Layout>} />
          <Route path="/admin/activity" element={<Layout roles={['admin']}><AdminActivity /></Layout>} />
          <Route path="/emergency-contacts" element={<Layout roles={['passenger']}><EmergencyContacts /></Layout>} />
          <Route path="/passenger" element={<Layout roles={['passenger']}><PassengerDashboard /></Layout>} />
          <Route path="/ride/request" element={<Layout roles={['passenger']}><RequestRide /></Layout>} />
          <Route path="/ride/active" element={<Layout roles={['passenger', 'driver']}><ActiveRide /></Layout>} />
          <Route path="/ride/:id" element={<Layout roles={['passenger', 'driver']}><RideDetail /></Layout>} />
          <Route path="/payment/result" element={<Layout roles={['passenger']}><PaymentCheckout /></Layout>} />
          <Route path="/" element={<Layout><Home /></Layout>} />
        </Routes>
      </ToastProvider>
    </SocketProvider>
  );
}

export default App;
