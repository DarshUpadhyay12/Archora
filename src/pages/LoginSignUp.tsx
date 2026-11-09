import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck, Loader2 } from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { FormField } from '@/components/common/FormField';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { Modal } from '@/components/common/Modal';
import { showToast } from '@/components/common/Toast';
import { storageService } from '@/services/storageService';

export const LoginSignUp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // If already logged in, redirect straight to studio home
  useEffect(() => {
    if (storageService.isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (activeTab === 'signup' && !fullName.trim()) {
      errs.fullName = 'Full name is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (activeTab === 'signin') {
        const session = await storageService.loginServer(email.trim(), password);
        showToast({
          type: 'success',
          title: 'Studio Session Started',
          message: `Signed in as ${session.name}. Studio workspace unlocked.`,
        });
      } else {
        const displayName = fullName.trim() || email.split('@')[0];
        const session = await storageService.registerServer({
          email: email.trim(),
          password,
          fullName: displayName,
        });
        showToast({
          type: 'success',
          title: 'Welcome to Archora',
          message: `Studio account registered for ${session.name}. Workspace unlocked.`,
        });
      }

      const destination = (location.state as any)?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: activeTab === 'signin' ? 'Sign In Failed' : 'Registration Failed',
        message: err.message || 'Could not authenticate with Archora studio database.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !/\S+@\S+\.\S+/.test(forgotEmail)) {
      showToast({ type: 'error', title: 'Invalid Email', message: 'Enter a valid email address' });
      return;
    }
    setIsForgotModalOpen(false);
    showToast({
      type: 'info',
      title: 'Password Reset Demo',
      message: `Password instructions simulated for ${forgotEmail}.`,
    });
  };

  return (
    <div className="relative min-h-screen py-16 lg:py-24 flex items-center justify-center px-4 overflow-hidden">
      {/* Background Architectural Illustration: Indian Stepwell (Chand Baori / Vav) */}
      <ArchitectureBackground
        imageSrc="/images/architecture/login_feathered.png"
        fallbackSrc="/images/architecture/login_hero_bg.jpg"
        alt="Architectural pen and ink etching of Chand Baori Indian Stepwell"
        alignment="center"
        opacity={0.20}
      />

      {/* Floating Parchment Authentication Card */}
      <div className="relative z-10 w-full max-w-md bg-cream-light/95 backdrop-blur-md border border-archBorder rounded-3xl p-8 sm:p-10 shadow-arch-lg space-y-8 animate-fadeIn">
        {/* Top Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cream border border-archBorder/60 text-[11px] font-semibold uppercase tracking-[0.2em] text-espresso">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Studio Access Required</span>
          </div>
          <h2 className="text-3xl font-serif font-medium text-ink pt-1">
            {activeTab === 'signin' ? 'Welcome to Archora' : 'Join the Studio'}
          </h2>
          <p className="text-xs text-ink-muted">
            {activeTab === 'signin'
              ? 'Sign in to access the AI Architecture Workspace & tools.'
              : 'Create an account to personalize your architectural workspace.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex border border-archBorder/60 rounded-xl p-1 bg-cream">
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              setErrors({});
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'signin'
                ? 'bg-espresso text-cream shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setErrors({});
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'signup'
                ? 'bg-espresso text-cream shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'signup' && (
            <FormField label="Full Name" error={errors.fullName} required>
              <div className="relative">
                <User className="w-4 h-4 text-taupe absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Deeth Upadhyay"
                  className="w-full bg-cream border border-archBorder/70 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
                />
              </div>
            </FormField>
          )}

          <FormField label="Email Address" error={errors.email} required>
            <div className="relative">
              <Mail className="w-4 h-4 text-taupe absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deeth@anchora.studio"
                className="w-full bg-cream border border-archBorder/70 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </div>
          </FormField>

          <FormField label="Password" error={errors.password} required>
            <div className="relative">
              <Lock className="w-4 h-4 text-taupe absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-cream border border-archBorder/70 rounded-xl pl-9 pr-10 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-taupe hover:text-ink p-1"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormField>

          {activeTab === 'signin' && (
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-ink-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-archBorder text-espresso focus:ring-espresso"
                />
                <span>Remember this studio</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-espresso hover:underline font-medium"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <PrimaryButton 
            type="submit" 
            className="w-full justify-center py-2.5 mt-2" 
            disabled={isSubmitting}
            icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            showArrow={!isSubmitting}
          >
            {isSubmitting
              ? 'Authenticating...'
              : activeTab === 'signin'
              ? 'Sign In to Workspace'
              : 'Create Studio Account'}
          </PrimaryButton>
        </form>

        {/* Footer Note */}
        <div className="pt-2 border-t border-archBorder/40 text-center">
          <p className="text-[11px] text-ink-muted">
            Archora Architecture Workspace &bull; Sign in to unlock all AI tools
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset Studio Password"
        maxWidth="sm"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <p className="text-xs text-ink-muted leading-relaxed">
            Enter your registered email address and we will provide password reset instructions.
          </p>
          <FormField label="Email Address">
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="deeth@anchora.studio"
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsForgotModalOpen(false)}>
              Cancel
            </Button>
            <PrimaryButton type="submit" size="sm">
              Send Link
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
