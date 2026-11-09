import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { ToastContainer } from '@/components/common/Toast';
import { MobileBottomNav } from '@/components/common/MobileBottomNav';
import { OfflineNotice } from '@/components/common/OfflineNotice';
import { PWAInstallBanner } from '@/components/common/PWAInstallBanner';

export const AppLayout: React.FC = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex flex-col min-h-screen bg-parchment text-ink antialiased selection:bg-beige selection:text-chocolate relative">
      {/* Ambient Radial Gradient for Frosted Glass Refraction */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[radial-gradient(ellipse_80%_40%_at_50%_-10%,rgba(196,164,124,0.25),rgba(255,255,255,0))]" 
        aria-hidden="true" 
      />
      <Header />
      <OfflineNotice />
      <main className="flex-1 relative z-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
      <PWAInstallBanner />
      <ToastContainer />
    </div>
  );
};
