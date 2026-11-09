import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';
import { pwaService } from '@/services/pwaService';

export const PWAInstallBanner: React.FC = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check dismissal status in local session
    const dismissed = sessionStorage.getItem('archora_pwa_banner_dismissed') === 'true';
    setIsDismissed(dismissed);

    const updateState = () => {
      setCanInstall(pwaService.getCanInstall());
      setIsInstalled(pwaService.getIsInstalled());
      setIsIOS(pwaService.getIsIOS());
    };

    updateState();
    window.addEventListener('archora-pwa-state-change', updateState);
    return () => window.removeEventListener('archora-pwa-state-change', updateState);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosGuide(!showIosGuide);
      return;
    }

    const accepted = await pwaService.promptInstall();
    if (accepted) {
      setCanInstall(false);
      setIsInstalled(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('archora_pwa_banner_dismissed', 'true');
  };

  if (isInstalled || isDismissed || (!canInstall && !isIOS)) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-3 md:right-6 z-40 max-w-sm w-[calc(100vw-1.5rem)] md:w-auto animate-fadeIn">
      <div className="p-3.5 sm:p-4 rounded-2xl glass-panel bg-cream/95 backdrop-blur-2xl border border-archBorder/60 shadow-glass space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-espresso text-cream flex items-center justify-center flex-shrink-0 shadow-arch-sm">
              <Smartphone className="w-4 h-4 text-beige" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-ink font-serif leading-tight">
                Install Archora Studio App
              </h4>
              <p className="text-[11px] text-ink-muted leading-tight mt-0.5">
                Fast, responsive workspace experience on phone & tablet
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="p-1 rounded-full text-taupe hover:text-espresso hover:bg-parchment/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {showIosGuide && (
          <div className="p-2.5 rounded-xl bg-parchment/70 border border-archBorder/50 text-[11px] text-ink-muted space-y-1">
            <div className="font-semibold text-espresso flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>To install on iPhone or iPad:</span>
            </div>
            <ol className="list-decimal list-inside space-y-0.5 pl-1 text-[10px]">
              <li>Tap the <strong>Share</strong> button (box with arrow) in Safari.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            </ol>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleInstallClick}
            className="flex-1 py-1.5 px-3 rounded-xl bg-espresso text-cream hover:bg-chocolate text-xs font-semibold shadow-arch-sm transition-all flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isIOS ? (showIosGuide ? 'Hide Instructions' : 'Install on iOS') : 'Install App'}</span>
          </button>
          <button
            onClick={handleDismiss}
            className="py-1.5 px-3 rounded-xl border border-archBorder/50 text-xs font-medium text-ink-muted hover:text-ink hover:bg-parchment/50 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};
