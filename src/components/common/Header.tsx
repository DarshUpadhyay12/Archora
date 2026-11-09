import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Menu,
  X,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AnchoraLogo } from './AnchoraLogo';
import { PrimaryButton } from './Buttons';
import { GlobalSearchModal } from './GlobalSearchModal';
import { storageService, AuthSession } from '@/services/storageService';
import { showToast } from './Toast';
import { getStudioMood } from '@/config/genzVoice';

interface HeaderProps {
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(() => storageService.getAuthSession());
  const location = useLocation();
  const navigate = useNavigate();

  // Slider scroll & drag state
  const sliderRef = useRef<HTMLDivElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollStart, setScrollStart] = useState(0);

  // Sync auth state across tabs and windows
  useEffect(() => {
    const syncSession = () => {
      setSession(storageService.getAuthSession());
    };

    window.addEventListener('anchora-auth-change', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener('anchora-auth-change', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  // Update slider scroll indicators (requires meaningful overflow > 14px)
  const checkSliderScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const hasOverflow = scrollWidth - clientWidth > 14;
    setCanScrollLeft(hasOverflow && scrollLeft > 10);
    setCanScrollRight(hasOverflow && scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkSliderScroll();
    window.addEventListener('resize', checkSliderScroll);
    return () => window.removeEventListener('resize', checkSliderScroll);
  }, [session, location.pathname]);

  // Center active nav item when route changes
  useEffect(() => {
    if (activeLinkRef.current && sliderRef.current) {
      activeLinkRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [location.pathname]);

  const handleSliderScroll = (offset: number) => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - sliderRef.current.offsetLeft);
    setScrollStart(sliderRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    sliderRef.current.scrollLeft = scrollStart - walk;
  };

  const handleLogout = () => {
    storageService.logout();
    showToast({
      type: 'info',
      title: 'Studio Session Closed',
      message: 'You have been logged out. Sign in anytime to resume.',
    });
    navigate('/login', { replace: true });
  };

  // Main feature navigation
  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Features', path: '/features' },
    { label: 'Architecture Tutor', path: '/tutor' },
    { label: 'Concept Generator', path: '/concepts' },
    { label: 'VastuVision', path: '/vastu' },
    { label: 'Jury & Portfolio', path: '/portfolio' },
    { label: 'Project Library', path: '/projects' },
    { label: 'Files', path: '/files' },
    { label: 'AI History', path: '/history' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full glass-nav-surface transition-all duration-300">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-3">
            
            {/* 1. Left: Archora Logo with Dedicated Architectural Boundary & Spacing */}
            <div className="flex-shrink-0 flex items-center pr-4 sm:pr-6 lg:pr-8 md:border-r border-archBorder/30">
              <AnchoraLogo size="md" />
            </div>

            {/* 2. Center: Smooth Horizontal Navigation Slider (shown when authenticated) */}
            {session && (
              <div className="hidden md:flex flex-1 items-center justify-center relative min-w-0 px-2 lg:px-4">
                {/* Left Scroll Chevron Button & Gradient Mask */}
                {canScrollLeft && (
                  <div className="absolute left-0 inset-y-0 z-20 flex items-center pr-3 pl-1 bg-gradient-to-r from-parchment/95 via-parchment/70 to-transparent pointer-events-auto">
                    <button
                      onClick={() => handleSliderScroll(-180)}
                      aria-label="Scroll navigation left"
                      className="p-1.5 rounded-full glass-scroll-btn text-espresso"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Slider Container inside Frosted Glass Capsule */}
                <div className="w-full max-w-fit px-1.5 py-1 rounded-full glass-nav-track overflow-hidden">
                  <nav
                    ref={sliderRef}
                    onScroll={checkSliderScroll}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeaveOrUp}
                    onMouseUp={handleMouseLeaveOrUp}
                    onMouseMove={handleMouseMove}
                    onWheel={(e) => {
                      if (e.deltaY !== 0 && sliderRef.current) {
                        sliderRef.current.scrollLeft += e.deltaY;
                      }
                    }}
                    className="flex items-center gap-1 overflow-x-auto slider-hide-scrollbar scroll-smooth py-0.5 px-0.5 select-none cursor-grab active:cursor-grabbing"
                  >
                    {navLinks.map((link) => {
                      const isActive = location.pathname === link.path;
                      return (
                        <NavLink
                          key={link.path}
                          to={link.path}
                          ref={isActive ? activeLinkRef : null}
                          className={`group relative px-3 py-1.5 lg:px-3.5 text-xs lg:text-[13px] font-medium rounded-full whitespace-nowrap flex-shrink-0 transition-all duration-200 select-none ${
                            isActive
                              ? 'glass-pill-nav-active font-semibold'
                              : 'glass-pill-nav hover:text-espresso'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-cream animate-pulse shadow-xs" />
                            )}
                            <span>{link.label}</span>
                          </span>
                        </NavLink>
                      );
                    })}
                  </nav>
                </div>

                {/* Right Scroll Chevron Button & Gradient Mask */}
                {canScrollRight && (
                  <div className="absolute right-0 inset-y-0 z-20 flex items-center pl-3 pr-1 bg-gradient-to-l from-parchment/95 via-parchment/70 to-transparent pointer-events-auto">
                    <button
                      onClick={() => handleSliderScroll(180)}
                      aria-label="Scroll navigation right"
                      className="p-1.5 rounded-full glass-scroll-btn text-espresso"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. Right: Studio Controls Cluster (Search, Profile Avatar Pill, Logout) */}
            <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 pl-3 sm:pl-4 lg:pl-6 md:border-l border-archBorder/30">
              {session ? (
                <>
                  {/* Subtle Studio Mood Pill */}
                  <div
                    className="hidden 2xl:flex items-center px-3 py-1 rounded-full bg-parchment/70 border border-archBorder/50 text-[11px] font-mono text-espresso/90 shadow-2xs select-none"
                    title="Real-time studio state"
                  >
                    {getStudioMood()}
                  </div>

                  {/* Search Button with keyboard shortcut hint */}
                  <button
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search Archora"
                    title="Quick Search (Press / to search concepts, drawings & sanity)"
                    className="p-2 sm:px-3 sm:py-1.5 rounded-full text-espresso hover:text-chocolate glass-button-pill flex items-center gap-2"
                  >
                    <Search className="w-4 h-4 text-espresso/80" />
                    <span className="hidden xl:inline text-xs font-medium text-ink-muted">Search</span>
                    <kbd className="hidden xl:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-parchment/80 border border-archBorder/60 text-taupe shadow-2xs">
                      /
                    </kbd>
                  </button>

                  {/* Profile Avatar Pill */}
                  <NavLink
                    to="/profile"
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-full glass-button-pill"
                    title="POV: Starchitect in training · Profile & Preferences"
                  >
                    <span className="w-6 h-6 rounded-full bg-espresso text-cream flex items-center justify-center text-[11px] font-semibold font-serif shadow-xs">
                      {session.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden sm:inline text-xs font-semibold text-ink truncate max-w-[120px]">
                      {session.name}
                    </span>
                  </NavLink>

                  {/* Clean Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="p-2 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium text-ink-muted hover:text-rose-700 bg-white/40 hover:bg-rose-50/90 backdrop-blur-md border border-archBorder/30 hover:border-rose-200 shadow-2xs transition-all flex items-center gap-1.5"
                    title="Escape studio before another revision"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Log Out</span>
                  </button>
                </>
              ) : (
                /* Unauthenticated Sign In Button */
                <PrimaryButton
                  to="/login"
                  size="sm"
                  icon={<LogIn className="w-3.5 h-3.5" />}
                  className="px-5 py-2 shadow-arch-sm"
                >
                  Sign In
                </PrimaryButton>
              )}

              {/* Mobile Menu Hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle mobile navigation"
                className="p-2 text-espresso md:hidden hover:bg-cream/80 rounded-xl border border-archBorder/40 transition-colors focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Mobile Navigation Drawer with Glassmorphism */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-archBorder/50 bg-cream/95 backdrop-blur-2xl px-5 pt-4 pb-6 space-y-3 animate-fadeIn shadow-arch-lg">
            {session ? (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-parchment/40 border border-archBorder/40 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-espresso text-cream flex items-center justify-center font-serif text-xs font-semibold">
                      {session.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-ink">{session.name}</div>
                      <div className="text-[10px] text-taupe">{session.email}</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Studio Active
                  </span>
                </div>

                <div className="text-[11px] uppercase tracking-wider text-taupe font-semibold px-2">
                  Studio Features
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {navLinks.map((link) => {
                    const isActive = location.pathname === link.path;
                    return (
                      <NavLink
                        key={link.path}
                        to={link.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 text-sm rounded-xl font-medium transition-all ${
                          isActive
                            ? 'bg-espresso text-cream font-semibold shadow-arch-sm'
                            : 'text-ink-muted hover:text-ink hover:bg-cream'
                        }`}
                      >
                        <span>{link.label}</span>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cream" />}
                      </NavLink>
                    );
                  })}
                </div>

                <div className="pt-4 flex flex-col gap-2 border-t border-archBorder/30">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setSearchOpen(true);
                    }}
                    className="w-full py-2.5 text-center text-xs font-semibold text-espresso bg-cream border border-archBorder/60 rounded-xl hover:bg-parchment-light transition-colors flex items-center justify-center gap-2"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search Studio Assets</span>
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full py-2.5 text-center text-xs font-semibold text-rose-800 bg-rose-50/80 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out of Studio</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="pt-2">
                <PrimaryButton
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center justify-center py-2.5"
                  icon={<LogIn className="w-4 h-4" />}
                >
                  Sign In to Studio
                </PrimaryButton>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Global Search Modal */}
      {session && <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />}
    </>
  );
};
