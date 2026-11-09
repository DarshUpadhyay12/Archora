import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// Global listener for toasts
type ToastListener = (toast: ToastItem) => void;
const listeners: Set<ToastListener> = new Set();

export const showToast = (toast: Omit<ToastItem, 'id'>) => {
  const item: ToastItem = {
    ...toast,
    id: `toast-${Date.now()}-${Math.random()}`,
    duration: toast.duration || 3500,
  };
  listeners.forEach((listener) => listener(item));
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast: ToastListener = (newToast) => {
      setToasts((prev) => [...prev, newToast]);

      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, newToast.duration);
      }
    };

    listeners.add(handleToast);
    return () => {
      listeners.delete(handleToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-cream-light border border-archBorder shadow-arch-lg text-ink transition-all duration-300 animate-slideUp"
        >
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-800" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-800" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-espresso" />}
          </div>
          <div className="flex-1 text-sm">
            <h5 className="font-semibold text-ink leading-tight">{toast.title}</h5>
            {toast.message && <p className="text-xs text-ink-muted mt-1">{toast.message}</p>}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-taupe hover:text-ink p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

