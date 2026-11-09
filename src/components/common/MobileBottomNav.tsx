import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  BookOpen,
  Sparkles,
  Compass,
  FolderKanban,
  HardDrive,
  User,
  LogIn,
} from 'lucide-react';
import { storageService, AuthSession } from '@/services/storageService';

export const MobileBottomNav: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(() => storageService.getAuthSession());
  const location = useLocation();

  useEffect(() => {
    const syncSession = () => setSession(storageService.getAuthSession());
    window.addEventListener('anchora-auth-change', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener('anchora-auth-change', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  // Items for authenticated studio session
  const authNavItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Tutor', path: '/tutor', icon: BookOpen },
    { label: 'Concepts', path: '/concepts', icon: Sparkles },
    { label: 'Vastu', path: '/vastu', icon: Compass },
    { label: 'Projects', path: '/projects', icon: FolderKanban },
    { label: 'Vault', path: '/files', icon: HardDrive },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  // Items for unauthenticated visitor
  const publicNavItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Features', path: '/features', icon: Sparkles },
    { label: 'Sign In', path: '/login', icon: LogIn },
  ];

  const items = session ? authNavItems : publicNavItems;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-2.5 inset-x-3 z-40 bg-cream/95 backdrop-blur-2xl border border-archBorder/60 rounded-2xl shadow-glass px-2 py-1.5 transition-all duration-300"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-around gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-medium transition-all duration-200 select-none ${
                isActive
                  ? 'bg-espresso text-cream font-semibold shadow-arch-sm scale-[1.02]'
                  : 'text-ink-muted hover:text-espresso hover:bg-parchment/60'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-cream' : 'text-espresso/80'}`} />
              <span className="truncate max-w-[54px]">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

