import { useState, useEffect, useCallback } from 'react';

const ICONS = {
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#2E7D32" />
      <path d="M5.5 10L8.5 13L14.5 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#D32F2F" />
      <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#E67E22" />
      <path d="M10 5.5V11M10 14V14.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#E91E8C" />
      <path d="M10 6V10.5M10 13.5V14" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

const BG = {
  success: 'bg-[#e8f5e9] border-[#a5d6a7]',
  error: 'bg-[#ffebee] border-[#ef9a9a]',
  warning: 'bg-[#fff8e1] border-[#ffe082]',
  info: 'bg-[#fce4ec] border-[#f48fb1]',
};

const TEXT = {
  success: 'text-[#2E7D32]',
  error: 'text-[#D32F2F]',
  warning: 'text-[#E67E22]',
  info: 'text-[#E91E8C]',
};

const PROGRESS = {
  success: 'bg-[#2E7D32]',
  error: 'bg-[#D32F2F]',
  warning: 'bg-[#E67E22]',
  info: 'bg-[#E91E8C]',
};

function ToastItem({ id, type, message, duration, onRemove }) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(id), 300);
  }, [id, onRemove]);

  useEffect(() => {
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, dismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-sm border shadow-[0_4px_12px_rgba(0,0,0,0.08)] min-w-[280px] max-w-[400px] transition-all duration-300 ${BG[type]} ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
      role="alert"
    >
      <span className="shrink-0 mt-0.5">{ICONS[type]}</span>
      <p className={`flex-1 text-sm font-medium m-0 leading-snug ${TEXT[type]}`}>{message}</p>
      <button
        onClick={dismiss}
        className="shrink-0 bg-transparent border-none cursor-pointer p-0.5 opacity-40 hover:opacity-100 transition"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={TEXT[type]} />
        </svg>
      </button>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/6 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${PROGRESS[type]}`}
          style={{ animation: `toast-shrink ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onRemove={removeToast} />
      ))}
    </div>
  );
}

export default ToastContainer;
