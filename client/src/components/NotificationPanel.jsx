import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { notificationAPI } from '../services/api';

const TYPE_ICONS = {
  trip_request: '🚗',
  trip_accepted: '✅',
  trip_declined: '❌',
  new_review: '⭐',
  ride_status: '📍',
  sos_alert: '🆘',
  payment: '💳',
  verification: '📋',
  new_trip: '🚀',
};

const TYPE_ROUTES = {
  trip_request: '/driver/dashboard',
  trip_accepted: '/ride/active',
  trip_declined: '/passenger',
  new_review: '/driver/dashboard',
  ride_status: '/ride/active',
  sos_alert: '/admin/sos',
  payment: '/driver/earnings',
};

function NotificationPanel({ isOpen, onClose }) {
  const { notifications, unreadCount, refresh, markRead, markAllRead, removeNotification } = useNotifications();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  useEffect(() => {
    if (isOpen && notifications.length === 0) refresh();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleClick = async (notification) => {
    if (!notification.isRead) {
      await markRead(notification.id);
    }
    const route = TYPE_ROUTES[notification.type];
    if (route) navigate(route);
    onClose();
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        ref={panelRef}
        className="relative w-full max-w-sm bg-white h-full shadow-xl flex flex-col animate-slide-in-right"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0E0E8] flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#880E4F] m-0">Notifications</h2>
            <p className="text-xs text-[#8B8B9E] m-0">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-[#E91E8C] hover:text-[#C2185B] transition cursor-pointer bg-transparent border-none"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FFF8FA] text-[#8B8B9E] transition cursor-pointer border-none bg-transparent"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <svg className="w-12 h-12 text-[#B0B0C0] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
              <p className="text-sm text-[#8B8B9E] m-0">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-5 py-4 border-b border-[#F0E0E8] transition cursor-pointer hover:bg-[#FFF8FA] group ${
                    !n.isRead ? 'bg-[#FFF8FA]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm m-0 truncate ${!n.isRead ? 'font-bold text-[#1A1A1A]' : 'text-[#1A1A1A]'}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#E91E8C] flex-shrink-0" />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-xs text-[#8B8B9E] m-0 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[0.65rem] text-[#B0B0C0] m-0 mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F0E0E8] text-[#B0B0C0] hover:text-[#E91E8C] transition cursor-pointer border-none bg-transparent flex-shrink-0 mt-0.5"
                      title="Remove notification"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationPanel;
