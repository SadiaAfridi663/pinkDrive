import { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { useSocket } from './SocketContext';
import { adminAPI, rideAPI } from '../services/api';

const NotificationContext = createContext({ counts: {} });

function NotificationProvider({ children }) {
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!user) {
      setCounts({});
      return;
    }

    if (user.role === 'admin') {
      const fetchStats = async () => {
        try {
          const res = await adminAPI.getStats();
          const s = res.data.data.stats || {};
          setCounts({
            verifications: s.pendingVerifications || 0,
            sos: s.activeSOS || 0,
            disputes: s.openDisputes || 0,
          });
        } catch { /* ignore */ }
      };
      fetchStats();
      const interval = setInterval(fetchStats, 15000);
      return () => clearInterval(interval);
    }

    if (user.role === 'driver') {
      const fetchRides = async () => {
        try {
          const res = await rideAPI.getPendingRides();
          const rides = res.data.data.rides || [];
          setCounts({ availableRides: rides.length });
        } catch { /* ignore */ }
      };
      fetchRides();
      const interval = setInterval(fetchRides, 15000);
      return () => clearInterval(interval);
    }

    if (user.role === 'passenger') {
      const fetchActive = async () => {
        try {
          const res = await rideAPI.getActiveRide();
          const active = res.data.data.ride;
          setCounts({ activeRide: active ? 1 : 0 });
        } catch { setCounts({ activeRide: 0 }); }
      };
      fetchActive();
      const interval = setInterval(fetchActive, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    if (user?.role === 'admin') {
      const onAlert = () => setCounts((prev) => ({ ...prev, sos: (prev.sos || 0) + 1 }));
      const onVerification = () => {
        setCounts((prev) => ({ ...prev, verifications: (prev.verifications || 0) + 1 }));
      };
      socket.on('sos:alert', onAlert);
      socket.on('verification:new', onVerification);
      return () => {
        socket.off('sos:alert', onAlert);
        socket.off('verification:new', onVerification);
      };
    }
    if (user?.role === 'driver') {
      const onAvailable = () => setCounts((prev) => ({ ...prev, availableRides: (prev.availableRides || 0) + 1 }));
      socket.on('ride:available', onAvailable);
      return () => socket.off('ride:available', onAvailable);
    }
  }, [socket, user]);

  return (
    <NotificationContext.Provider value={{ counts }}>
      {children}
    </NotificationContext.Provider>
  );
}

function useNotifications() {
  return useContext(NotificationContext);
}

export { NotificationProvider, useNotifications, NotificationContext };