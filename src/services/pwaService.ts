/**
 * Archora PWA Service
 * Manages Progressive Web App installation prompts, standalone mode detection,
 * and online/offline network connectivity status.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

class PwaService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled: boolean = false;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkInstalled();

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e as BeforeInstallPromptEvent;
        this.notifyChange();
      });

      window.addEventListener('appinstalled', () => {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.notifyChange();
      });

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyChange();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyChange();
      });
    }
  }

  private checkInstalled(): void {
    if (typeof window === 'undefined') return;

    // Check standalone display mode in browser
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    this.isInstalled = isStandalone;
  }

  public getCanInstall(): boolean {
    return !!this.deferredPrompt && !this.isInstalled;
  }

  public getIsInstalled(): boolean {
    return this.isInstalled;
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public getIsIOS(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.notifyChange();
        return true;
      }
    } catch (err) {
      console.warn('[Archora PWA] Prompt install error:', err);
    }
    return false;
  }

  private notifyChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('archora-pwa-state-change', {
        detail: {
          canInstall: this.getCanInstall(),
          isInstalled: this.isInstalled,
          isOnline: this.isOnline,
        }
      }));
    }
  }
}

export const pwaService = new PwaService();

