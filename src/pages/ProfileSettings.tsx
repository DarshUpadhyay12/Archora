import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Sliders, 
  BarChart3, 
  HardDrive, 
  Edit2, 
  LogOut
} from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { FormField } from '@/components/common/FormField';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { Modal } from '@/components/common/Modal';
import { showToast } from '@/components/common/Toast';
import { storageService } from '@/services/storageService';
import { UserProfile, AppSettings } from '@/types';
import { AiUsageDashboard } from '@/components/usage/AiUsageDashboard';
import { BackupRestorePanel } from '@/components/backup/BackupRestorePanel';
import { pwaService } from '@/services/pwaService';
import { GENZ_VOICE } from '@/config/genzVoice';

export const ProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'usage' | 'preferences' | 'data'>('profile');
  const [profile, setProfile] = useState<UserProfile>(storageService.getUserProfile());
  const [settings, setSettings] = useState<AppSettings>(storageService.getAppSettings());

  // Edit profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(profile.fullName);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editSemester, setEditSemester] = useState(profile.semester);
  const [editBio, setEditBio] = useState(profile.bio);

  useEffect(() => {
    setProfile(storageService.getUserProfile());
    setSettings(storageService.getAppSettings());
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...profile,
      fullName: editName.trim(),
      email: editEmail.trim(),
      semester: editSemester.trim(),
      bio: editBio.trim(),
      avatarInitials: editName.trim().split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'DU',
    };
    storageService.saveUserProfile(updated);
    setProfile(updated);
    setIsEditingProfile(false);
    showToast({ type: 'success', title: 'Profile Updated', message: 'Studio profile saved to local storage.' });
  };

  const handleUpdateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    storageService.saveAppSettings(updated);
    setSettings(updated);
    showToast({ type: 'info', title: 'Preference Saved', message: `Setting updated.` });
  };

  return (
    <div className="relative min-h-screen py-12 lg:py-20 overflow-hidden">
      {/* Background Architectural Illustration: Indian Haveli Courtyard with pool */}
      <ArchitectureBackground
        imageSrc="/images/architecture/profile_feathered.png"
        fallbackSrc="/images/architecture/profile_hero_bg.jpg"
        alt="Architectural pen and ink etching of traditional Indian Haveli courtyard with fountain"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Page Heading */}
        <div className="max-w-2xl">
          <PageHeading
            kicker={GENZ_VOICE.pageHeaders.profile.kicker}
            title={GENZ_VOICE.pageHeaders.profile.title}
            description={GENZ_VOICE.pageHeaders.profile.subtitle}
          />
        </div>

        {/* Main Settings Card with Sidebar */}
        <div className="rounded-3xl glass-panel shadow-glass overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
          {/* Settings Sidebar */}
          <div className="md:col-span-4 p-6 border-b md:border-b-0 md:border-r border-archBorder/30 bg-parchment/20 backdrop-blur-xs space-y-2">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-taupe">
              Studio Configuration
            </div>

            {[
              { id: 'profile', label: 'Student Profile', icon: User },
              { id: 'usage', label: 'AI Usage Dashboard', icon: BarChart3 },
              { id: 'preferences', label: 'Appearance & Layout', icon: Sliders },
              { id: 'data', label: 'Backup & Restore', icon: HardDrive },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-3 ${
                    activeTab === tab.id
                      ? 'bg-espresso text-cream shadow-sm font-semibold'
                      : 'text-ink-muted hover:text-ink hover:bg-beige/40'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="pt-4 border-t border-archBorder/40">
              <button
                type="button"
                onClick={() => {
                  storageService.logout();
                  showToast({ type: 'info', title: 'Studio Session Ended', message: 'Signed out of Archora.' });
                  navigate('/login', { replace: true });
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-800 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-3 cursor-pointer"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span>Log Out of Studio</span>
              </button>
            </div>
          </div>

          {/* Settings Content Area */}
          <div className="md:col-span-8 p-6 sm:p-8">
            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between pb-4 border-b border-archBorder/40">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-espresso text-cream flex items-center justify-center font-serif text-xl font-semibold shadow-sm">
                      {profile.avatarInitials}
                    </div>
                    <div>
                      <h3 className="font-serif text-2xl font-semibold text-ink">
                        {profile.fullName}
                      </h3>
                      <p className="text-xs text-taupe font-mono">{profile.role}</p>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setEditName(profile.fullName);
                      setEditEmail(profile.email);
                      setEditSemester(profile.semester);
                      setEditBio(profile.bio);
                      setIsEditingProfile(true);
                    }}
                  >
                    Edit Profile
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-cream border border-archBorder/60 space-y-1">
                    <span className="text-[11px] font-mono text-taupe uppercase">Institution</span>
                    <p className="font-medium text-ink">{profile.university}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-cream border border-archBorder/60 space-y-1">
                    <span className="text-[11px] font-mono text-taupe uppercase">Studio Level</span>
                    <p className="font-medium text-ink">{profile.semester}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-cream border border-archBorder/60 space-y-1">
                    <span className="text-[11px] font-mono text-taupe uppercase">Studio Email</span>
                    <p className="font-medium text-ink">{profile.email}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-cream border border-archBorder/60 space-y-1">
                    <span className="text-[11px] font-mono text-taupe uppercase">Workspace Mode</span>
                    <p className="font-medium text-ink">Local Single-User Architecture Studio</p>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-espresso block mb-1.5">
                    Studio Focus & Bio
                  </span>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed bg-cream p-4 rounded-2xl border border-archBorder/60">
                    {profile.bio}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-espresso block mb-2">
                    Research & Tectonic Interests
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, i) => (
                      <span
                        key={i}
                        className="text-xs font-mono px-3 py-1 rounded-full bg-beige/50 border border-archBorder/60 text-espresso"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AI USAGE DASHBOARD */}
            {activeTab === 'usage' && (
              <AiUsageDashboard />
            )}

            {/* TAB 3: PREFERENCES & APPEARANCE */}
            {activeTab === 'preferences' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-3 border-b border-archBorder/40">
                  <h3 className="font-serif text-xl font-semibold text-ink">
                    Appearance & Reading Preferences
                  </h3>
                  <p className="text-xs text-ink-muted mt-1">
                    Fine-tune the warm parchment editorial palette and typography density.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-cream border border-archBorder/60">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                        Parchment Warmth Tone
                      </h4>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Adjust paper background temperature.
                      </p>
                    </div>
                    <select
                      value={settings.parchmentWarmth}
                      onChange={(e) => handleUpdateSetting('parchmentWarmth', e.target.value as any)}
                      className="bg-cream-light border border-archBorder/70 rounded-lg px-3 py-1.5 text-xs text-ink focus:outline-none"
                    >
                      <option value="soft">Soft Parchment (#F8EFE2)</option>
                      <option value="standard">Standard Editorial (#F3E5CF)</option>
                      <option value="deep">Aged Parchment (#E8D4BA)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-cream border border-archBorder/60">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                        High Contrast Typography
                      </h4>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Deepen dark ink headings for bright daylight reading.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.highContrastMode}
                      onChange={(e) => handleUpdateSetting('highContrastMode', e.target.checked)}
                      className="rounded border-archBorder text-espresso focus:ring-espresso w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-cream border border-archBorder/60">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                        Reduced Motion
                      </h4>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Disable subtle hover zoom and background translate effects.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reducedMotion}
                      onChange={(e) => handleUpdateSetting('reducedMotion', e.target.checked)}
                      className="rounded border-archBorder text-espresso focus:ring-espresso w-4 h-4"
                    />
                  </div>

                  {/* Progressive Web App / Mobile Installation Tile */}
                  <div className="p-4 rounded-2xl bg-cream-light border border-archBorder/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                          Universal Web App (PWA)
                        </h4>
                        <p className="text-xs text-ink-muted mt-0.5">
                          Install Archora as a standalone application on your phone, tablet, or desktop.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        PWA Ready
                      </span>
                    </div>

                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          if (pwaService.getIsIOS()) {
                            showToast({
                              type: 'info',
                              title: 'Install on iOS',
                              message: 'In Safari, tap the Share button and select "Add to Home Screen".',
                            });
                          } else {
                            const accepted = await pwaService.promptInstall();
                            if (accepted) {
                              showToast({
                                type: 'success',
                                title: 'App Installed',
                                message: 'Archora is now installed on your device home screen!',
                              });
                            } else {
                              showToast({
                                type: 'info',
                                title: 'Already Installed or Available in Browser Menu',
                                message: 'You can install Archora anytime via your browser address bar or menu (Install App).',
                              });
                            }
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-espresso text-cream hover:bg-chocolate text-xs font-semibold shadow-arch-sm transition-all flex items-center gap-1.5"
                      >
                        <span>Install on This Device</span>
                      </button>
                      <span className="text-[11px] text-taupe">
                        Works offline with cached data & standalone window mode.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: BACKUP & RESTORE */}
            {activeTab === 'data' && (
              <BackupRestorePanel />
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditingProfile}
        onClose={() => setIsEditingProfile(false)}
        title="Edit Profile Information"
        maxWidth="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <FormField label="Full Name" required>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </FormField>

          <FormField label="Email" required>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </FormField>

          <FormField label="Semester / Year">
            <input
              type="text"
              value={editSemester}
              onChange={(e) => setEditSemester(e.target.value)}
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </FormField>

          <FormField label="Bio / Studio Statement">
            <textarea
              rows={3}
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso resize-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-archBorder/40">
            <Button variant="secondary" size="sm" onClick={() => setIsEditingProfile(false)}>
              Cancel
            </Button>
            <PrimaryButton type="submit" size="sm">
              Save Profile
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
