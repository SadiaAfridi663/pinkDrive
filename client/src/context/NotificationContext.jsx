import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { useSocket } from './SocketContext';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../constants/socketEvents';
import { notificationAPI } from '../services/api';
import logger from '../utils/logger';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  counts: {},
  refresh: () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

function NotificationProvider({ children }) {
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const counts = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead);
    return {
      verifications: unread.filter((n) => n.type === 'verification').length,
      sos: unread.filter((n) => n.type === 'sos_alert').length,
      disputes: unread.filter((n) => n.type === 'dispute').length,
      availableRides: unread.filter((n) => n.type === 'ride_available' || n.type === 'new_trip').length,
      activeRide: unread.filter((n) => n.type === 'ride_status').length,
    };
  }, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [listRes, countRes] = await Promise.all([
        notificationAPI.getAll({ limit: 100 }),
        notificationAPI.getUnreadCount(),
      ]);
      setNotifications(listRes.data.data.notifications || []);
      setUnreadCount(countRes.data.data.unreadCount || 0);
    } catch {
      // Silent fail
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleNewNotification = (data) => {
      logger.info('[Notification] New notification via WebSocket:', data.type);
      setUnreadCount((prev) => prev + 1);
      setNotifications((prev) => [{
        id: data.id || `temp-${Date.now()}`,
        userId: user.id,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || null,
        isRead: false,
        createdAt: new Date().toISOString(),
      }, ...prev]);
    };

    const handleReconnect = () => {
      socket.emit(CLIENT_EVENTS.JOIN_USER);
    };

    socket.on(SERVER_EVENTS.NOTIFICATION_NEW, handleNewNotification);
    socket.on('connect', handleReconnect);
    socket.emit(CLIENT_EVENTS.JOIN_USER);

    return () => {
      socket.off(SERVER_EVENTS.NOTIFICATION_NEW, handleNewNotification);
      socket.off('connect', handleReconnect);
    };
  }, [socket, user]);

  const markRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        counts,
        refresh: fetchNotifications,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

function useNotifications() {
  return useContext(NotificationContext);
}

export { NotificationProvider, useNotifications, NotificationContext };
