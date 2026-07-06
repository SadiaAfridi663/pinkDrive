import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import DriverVerification from './pages/DriverVerification';
import DriverHub from './pages/DriverHub';
import DriverRides from './pages/DriverRides';
import DriverEarnings from './pages/DriverEarnings';
import DriverWithdraw from './pages/DriverWithdraw';
import AdminHub from './pages/AdminHub';
import PassengerHub from './pages/PassengerHub';
import AdminVerification from './pages/AdminVerification';
import AdminGeoFence from './pages/AdminGeoFence';
import AdminSOS from './pages/AdminSOS';
import AdminUsers from './pages/AdminUsers';
import AdminRides from './pages/AdminRides';
import AdminRideDetail from './pages/AdminRideDetail';
import AdminActivity from './pages/AdminActivity';
import AdminPayments from './pages/AdminPayments';
import AdminDisputes from './pages/AdminDisputes';
import AdminWallet from './pages/AdminWallet';
import EmergencyContacts from './pages/EmergencyContacts';
import PassengerBidding from './pages/PassengerBidding';
import RequestRide from './pages/RequestRide';
import ActiveRide from './pages/ActiveRide';
import RideDetail from './pages/RideDetail';
import PaymentCheckout from './pages/PaymentCheckout';
import WalletPage from './pages/WalletPage';
import CreateSharedTrip from './pages/CreateSharedTrip';

function Home() {
  const { user } = useContext(AuthContext);
  if (!user) return null;
  if (user.role === 'passenger') return <Navigate to="/passenger" replace />;
  if (user.role === 'driver') return <Navigate to="/driver/dashboard" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return null;
}

function Layout({ children, roles, title, subtitle }) {
  return (
    <ProtectedRoute roles={roles}>
      <DashboardLayout title={title} subtitle={subtitle}>
        {children}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <SocketProvider>
      <ToastProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/driver/verification" element={<Layout roles={['driver']} title="Documents" subtitle="Verification documents"><DriverVerification /></Layout>} />
            <Route path="/wallet" element={<Layout roles={['passenger', 'driver']} title="Wallet" subtitle="Your balance & top-up"><WalletPage /></Layout>} />
            <Route path="/wallet/earnings" element={<Layout roles={['driver']} title="Earnings" subtitle="Track your revenue"><DriverEarnings /></Layout>} />
            <Route path="/wallet/withdraw" element={<Layout roles={['driver']} title="Withdraw" subtitle="Request a payout"><DriverWithdraw /></Layout>} />
            <Route path="/driver/dashboard" element={<ProtectedRoute roles={['driver']}><DriverHub /></ProtectedRoute>} />
            <Route path="/driver/rides" element={<Layout roles={['driver']} title="Rides" subtitle="Accept and manage rides"><DriverRides /></Layout>} />
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminHub /></ProtectedRoute>} />
            <Route path="/admin/verifications" element={<Layout roles={['admin']} title="Verifications" subtitle="Review driver documents"><AdminVerification /></Layout>} />
            <Route path="/admin/geo-fence" element={<Layout roles={['admin']} title="Geo-Fence" subtitle="Manage service areas"><AdminGeoFence /></Layout>} />
            <Route path="/admin/sos" element={<Layout roles={['admin']} title="SOS Alerts" subtitle="Emergency alerts"><AdminSOS /></Layout>} />
            <Route path="/admin/users" element={<Layout roles={['admin']} title="Users" subtitle="Manage all accounts"><AdminUsers /></Layout>} />
            <Route path="/admin/rides" element={<Layout roles={['admin']} title="Rides" subtitle="Monitor all rides"><AdminRides /></Layout>} />
            <Route path="/admin/rides/:id" element={<Layout roles={['admin']} title="Ride Details" subtitle="View ride information"><AdminRideDetail /></Layout>} />
            <Route path="/admin/activity" element={<Layout roles={['admin']} title="Activity" subtitle="System activity log"><AdminActivity /></Layout>} />
            <Route path="/admin/payments" element={<Layout roles={['admin']} title="Payments" subtitle="Revenue tracking"><AdminPayments /></Layout>} />
            <Route path="/admin/disputes" element={<Layout roles={['admin']} title="Disputes" subtitle="Open cases"><AdminDisputes /></Layout>} />
            <Route path="/admin/wallet" element={<Layout roles={['admin']} title="Wallets" subtitle="Driver wallets & withdrawals"><AdminWallet /></Layout>} />
            <Route path="/emergency-contacts" element={<Layout roles={['passenger']} title="Emergency Contacts" subtitle="Your emergency contacts"><EmergencyContacts /></Layout>} />
            <Route path="/passenger" element={<ProtectedRoute roles={['passenger']}><PassengerHub /></ProtectedRoute>} />
            <Route path="/ride/request" element={<Layout roles={['passenger']} title="Book a Ride" subtitle="Request a new ride"><RequestRide /></Layout>} />
            <Route path="/ride/bidding/:id" element={<Layout roles={['passenger']} title="Ride Bidding" subtitle="Choose a driver"><PassengerBidding /></Layout>} />
            <Route path="/ride/active" element={<Layout roles={['passenger', 'driver']} title="Active Ride" subtitle="Current ride details"><ActiveRide /></Layout>} />
            <Route path="/ride/:id" element={<Layout roles={['passenger', 'driver']} title="Ride Details" subtitle="View ride information"><RideDetail /></Layout>} />
            <Route path="/payment/result" element={<Layout roles={['passenger']} title="Payment" subtitle="Payment status"><PaymentCheckout /></Layout>} />
            <Route path="/driver/create-trip" element={<Layout roles={['driver']} title="Create Shared Trip" subtitle="Offer seats along your route"><CreateSharedTrip /></Layout>} />
            <Route path="/driver/shared-trips" element={<Layout roles={['driver']} title="Shared Trips" subtitle="Manage your shared trips"><CreateSharedTrip /></Layout>} />
            <Route path="/" element={<Layout title="Home"><Home /></Layout>} />
          </Routes>
        </NotificationProvider>
      </ToastProvider>
    </SocketProvider>
  );
}

export default App;
