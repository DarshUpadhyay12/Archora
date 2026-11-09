import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { pwaService } from '@/services/pwaService';

export const OfflineNotice: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(pwaService.getIsOnline());

  useEffect(() => {
    const handlePwaState = () => {
      setIsOnline(pwaService.getIsOnline());
    };

    window.addEventListener('archora-pwa-state-change', handlePwaState);
    window.addEventListener('online', handlePwaState);
    window.addEventListener('offline', handlePwaState);

    return () => {
      window.removeEventListener('archora-pwa-state-change', handlePwaState);
      window.removeEventListener('online', handlePwaState);
      window.removeEventListener('offline', handlePwaState);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-20 z-40 bg-amber-900/90 text-cream backdrop-blur-md px-4 py-2 border-b border-amber-800 text-xs flex items-center justify-between gap-3 shadow-md animate-fadeIn"
    >
      <div className="flex items-center gap-2 max-w-2xl mx-auto flex-1">
        <WifiOff className="w-4 h-4 text-amber-300 flex-shrink-0 animate-pulse" />
        <span className="leading-tight">
          <strong>Offline Mode Active</strong> — Your cached architectural data is safe. Live AI synthesis is taking a nap until Wi-Fi returns. Time to sketch on tracing paper like the ancients 📐
        </span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-2.5 py-1 rounded-full bg-cream text-espresso text-[11px] font-semibold hover:bg-parchment transition-all flex items-center gap-1 shadow-sm flex-shrink-0"
        title="Check connection"
      >
        <RefreshCw className="w-3 h-3" />
        <span className="hidden sm:inline">Reconnect</span>
      </button>
    </div>
  );
};

