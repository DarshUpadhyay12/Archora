import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Settings,
  Cloud,
  ExternalLink,
  Folder,
  FolderCheck,
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { showToast } from '@/components/common/Toast';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { FormField } from '@/components/common/FormField';
import { LoadingState } from '@/components/common/LoadingAndEmpty';

interface BackupItem {
  filename: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  backupVersion: string;
  schemaVersion: number;
  isAutomatic: boolean;
  fileCount: number;
  manifest?: any;
  integrityOk: boolean;
}

interface CloudBackupItem {
  id: string;
  fileId: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  uploadedAt: string;
  folderId: string;
  md5Checksum?: string;
  sha256Checksum?: string;
  webViewLink?: string;
}

interface GoogleDriveStatus {
  configured: boolean;
  connected: boolean;
  googleEmail?: string | null;
  googleName?: string | null;
  googlePicture?: string | null;
  folderId: string;
  folderName?: string | null;
  folderStatus: 'unverified' | 'verified' | 'inaccessible' | 'permission_denied';
  canUpload: boolean;
  lastVerified?: string | null;
  lastBackup?: string | null;
}

const DEFAULT_FOLDER_ID = '1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl';

export const BackupRestorePanel: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local');

  // Local Backups State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Restore Modal State
  const [restoreTarget, setRestoreTarget] = useState<{
    filename?: string;
    file?: File;
    cloudFileId?: string;
    manifest?: any;
    sizeBytes?: number;
  } | null>(null);

  // Delete Confirmation State
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  // Verification Details Modal
  const [verifyingItem, setVerifyingItem] = useState<{
    filename: string;
    loading: boolean;
    result?: any;
  } | null>(null);

  // Auto-backup Settings State
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoFrequency, setAutoFrequency] = useState<'daily' | 'weekly' | 'manual'>('daily');
  const [autoMaxRetained, setAutoMaxRetained] = useState(5);
  const [autoDestination, setAutoDestination] = useState('');
  const [autoLastRun, setAutoLastRun] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Google Drive State
  const [gdriveStatus, setGdriveStatus] = useState<GoogleDriveStatus | null>(null);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupItem[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [isVerifyingFolder, setIsVerifyingFolder] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [customFolderId, setCustomFolderId] = useState(DEFAULT_FOLDER_ID);
  const [deletingCloudItem, setDeletingCloudItem] = useState<{ fileId: string; filename: string } | null>(null);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle URL Query Params from OAuth redirect
  useEffect(() => {
    const gdriveParam = searchParams.get('gdrive');
    const gdriveError = searchParams.get('gdrive_error');

    if (gdriveParam === 'connected') {
      setActiveTab('cloud');
      showToast({
        type: 'success',
        title: 'Google Drive Connected',
        message: 'Your Google account has been authorized for Archora backups.',
      });
      // Clean query params from URL
      searchParams.delete('gdrive');
      searchParams.delete('folder');
      setSearchParams(searchParams, { replace: true });
    } else if (gdriveError) {
      setActiveTab('cloud');
      showToast({
        type: 'error',
        title: 'Google Connection Error',
        message: decodeURIComponent(gdriveError),
      });
      searchParams.delete('gdrive_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Load Local Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [historyRes, settingsRes] = await Promise.all([
        apiClient.getBackupHistory(),
        apiClient.getBackupSettings(),
      ]);

      setBackups(historyRes.backups || []);

      if (settingsRes.autoBackup) {
        setAutoBackupEnabled(settingsRes.autoBackup.enabled);
        setAutoFrequency(settingsRes.autoBackup.frequency);
        setAutoMaxRetained(settingsRes.autoBackup.maxRetained);
        setAutoDestination(settingsRes.autoBackup.destination);
        setAutoLastRun(settingsRes.autoBackup.lastRun);
      }
    } catch (err: any) {
      console.warn('[BackupRestorePanel] Failed to load local backups:', err);
      showToast({
        type: 'error',
        title: 'Could Not Load Backups',
        message: err.message || 'Failed to connect to backup repository.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load Google Drive Status & Cloud Backups
  const loadGoogleDriveData = async () => {
    setIsLoadingCloud(true);
    try {
      const statusRes = await apiClient.getGoogleDriveStatus();
      setGdriveStatus(statusRes.status);
      setCustomFolderId(statusRes.status.folderId || DEFAULT_FOLDER_ID);

      if (statusRes.status.connected) {
        try {
          const listRes = await apiClient.listCloudBackups();
          setCloudBackups(listRes.backups || []);
        } catch (listErr: any) {
          console.warn('[BackupRestorePanel] Could not list cloud backups:', listErr);
        }
      }
    } catch (err: any) {
      console.warn('[BackupRestorePanel] Failed to load Google Drive status:', err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadData();
    loadGoogleDriveData();
  }, []);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const res = await apiClient.createBackup();
      showToast({
        type: 'success',
        title: 'Backup Created Successfully',
        message: `Archive ${res.filename} generated and saved to studio backups.`,
      });
      loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Backup Failed',
        message: err.message || 'Failed to snapshot database and uploads.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      showToast({
        type: 'error',
        title: 'Invalid Archive Format',
        message: 'Only standard .zip backup archives are supported.',
      });
      return;
    }

    setRestoreTarget({
      file,
      filename: file.name,
      sizeBytes: file.size,
    });
  };

  const handleVerifyBackup = async (filename: string) => {
    setVerifyingItem({ filename, loading: true });
    try {
      const res = await apiClient.verifyBackup(filename);
      setVerifyingItem({
        filename,
        loading: false,
        result: (res as any).verification || res,
      });
    } catch (err: any) {
      setVerifyingItem(null);
      showToast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Could not verify archive integrity.',
      });
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreTarget) return;

    setIsRestoring(true);
    try {
      if (restoreTarget.cloudFileId) {
        // Restore from Google Drive
        const res = await apiClient.restoreFromCloudBackup(restoreTarget.cloudFileId);
        showToast({
          type: 'success',
          title: 'Workspace Restored from Google Drive',
          message: res.message || 'Restored projects, conversations, and drawings successfully.',
        });
      } else {
        // Restore from Local Archive or Upload
        const res = await apiClient.restoreBackup({
          filename: restoreTarget.filename,
          backupFile: restoreTarget.file,
        });

        showToast({
          type: 'success',
          title: 'Workspace Restored Successfully',
          message: `Restored ${res.stats?.projectsRestored || 0} projects, ${res.stats?.filesRestored || 0} drawings, and ${res.stats?.conversationsRestored || 0} conversations.`,
        });
      }

      setRestoreTarget(null);
      loadData();
      if (gdriveStatus?.connected) loadGoogleDriveData();

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Restoration Failed',
        message: err.message || 'Restoration was safely aborted and current data preserved.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async () => {
    if (!deletingFilename) return;

    try {
      await apiClient.deleteBackup(deletingFilename);
      showToast({
        type: 'success',
        title: 'Backup Deleted',
        message: `Archive ${deletingFilename} removed from storage.`,
      });
      setDeletingFilename(null);
      loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        message: err.message || 'Failed to remove backup file.',
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await apiClient.updateBackupSettings({
        enabled: autoBackupEnabled,
        frequency: autoFrequency,
        maxRetained: autoMaxRetained,
      });

      showToast({
        type: 'success',
        title: 'Backup Settings Saved',
        message: 'Automatic studio backup preferences updated.',
      });
      setIsSettingsOpen(false);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not update backup settings.',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Google Drive Handlers
  const handleConnectGoogle = async () => {
    try {
      const res = await apiClient.getGoogleAuthUrl();
      if (res.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Google Authorization Error',
        message: err.message || 'Failed to initialize Google OAuth.',
      });
    }
  };

  const handleVerifyFolder = async (folderIdToVerify?: string) => {
    setIsVerifyingFolder(true);
    try {
      const res = await apiClient.verifyGoogleDriveFolder(folderIdToVerify);
      if (res.success && res.folder.canAddChildren) {
        showToast({
          type: 'success',
          title: 'Google Drive Folder Verified',
          message: `Folder "${res.folder.name}" (${res.folder.id}) is valid and writable.`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Folder Verification Issue',
          message: res.folder.error || 'Your Google account does not have write access to this folder.',
        });
      }
      loadGoogleDriveData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Could not verify Google Drive folder.',
      });
    } finally {
      setIsVerifyingFolder(false);
    }
  };

  const handleSaveCustomFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFolderId.trim()) return;

    try {
      const res = await apiClient.setGoogleDriveFolder(customFolderId.trim());
      setIsFolderModalOpen(false);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Destination Folder Configured',
          message: `Connected to "${res.folder.name}".`,
        });
      } else {
        showToast({
          type: 'info',
          title: 'Folder Configured (Unverified)',
          message: res.folder.error || 'Folder set, but verification requires checking account permissions.',
        });
      }
      loadGoogleDriveData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed to Set Folder',
        message: err.message || 'Could not update folder destination.',
      });
    }
  };

  const handleUploadCloudBackup = async () => {
    setIsUploadingCloud(true);
    try {
      const res = await apiClient.uploadCloudBackup();
      showToast({
        type: 'success',
        title: 'Uploaded to Google Drive',
        message: res.message || 'Backup snapshot created and uploaded to your Google Drive folder.',
      });
      loadGoogleDriveData();
      loadData(); // also updates local list
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Cloud Upload Failed',
        message: err.message || 'Failed to upload backup to Google Drive.',
      });
    } finally {
      setIsUploadingCloud(false);
    }
  };

  const handleVerifyCloudBackup = async (fileId: string, filename: string) => {
    setVerifyingItem({ filename, loading: true });
    try {
      const res = await apiClient.verifyCloudBackup(fileId);
      setVerifyingItem({
        filename,
        loading: false,
        result: res.verification,
      });
    } catch (err: any) {
      setVerifyingItem(null);
      showToast({
        type: 'error',
        title: 'Cloud Verification Failed',
        message: err.message || 'Could not verify cloud backup archive.',
      });
    }
  };

  const handleDeleteCloudBackup = async () => {
    if (!deletingCloudItem) return;

    try {
      await apiClient.deleteCloudBackup(deletingCloudItem.fileId);
      showToast({
        type: 'success',
        title: 'Cloud Backup Deleted',
        message: `Removed "${deletingCloudItem.filename}" from Google Drive.`,
      });
      setDeletingCloudItem(null);
      loadGoogleDriveData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        message: err.message || 'Could not delete backup from Google Drive.',
      });
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await apiClient.disconnectGoogleDrive();
      showToast({
        type: 'info',
        title: 'Google Drive Disconnected',
        message: 'Tokens cleared. Local Archora backups remain fully operational.',
      });
      setDisconnectConfirmOpen(false);
      loadGoogleDriveData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Disconnect Failed',
        message: err.message || 'Could not disconnect Google Drive.',
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6 animate-fadeIn text-ink">
      {/* Tab Navigation: Local vs Google Drive Cloud */}
      <div className="flex items-center gap-2 p-1 bg-beige/40 rounded-2xl border border-archBorder/60 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('local')}
          className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'local'
              ? 'bg-espresso text-cream shadow-xs font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-cream-light/60'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Local Backups (ZIP)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cloud')}
          className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'cloud'
              ? 'bg-espresso text-cream shadow-xs font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-cream-light/60'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Google Drive Cloud</span>
          {gdriveStatus?.connected && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
          )}
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: LOCAL BACKUPS & RESTORE                                 */}
      {/* ============================================================== */}
      {activeTab === 'local' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-archBorder/40">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-xl sm:text-2xl font-semibold text-espresso">
                  Local Backup & Disaster Recovery
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cream border border-archBorder/60 text-espresso">
                  ZIP Standard v1.0
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Generate atomic, point-in-time snapshots of your SQLite database, uploaded drawings, notes, and AI conversations.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Hidden File Input for ZIP Upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleSelectUploadFile}
                accept=".zip"
                className="hidden"
              />

              <Button
                variant="secondary"
                size="sm"
                icon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => fileInputRef.current?.click()}
                title="Upload and restore a .zip backup archive"
              >
                Upload & Restore
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={<Settings className="w-3.5 h-3.5" />}
                onClick={() => setIsSettingsOpen(true)}
                title="Configure automatic backups"
              >
                Auto Settings
              </Button>

              <PrimaryButton
                size="sm"
                icon={<Archive className="w-3.5 h-3.5" />}
                onClick={handleCreateBackup}
                disabled={isCreating}
              >
                {isCreating ? 'Creating Snapshot...' : 'Create Backup Now'}
              </PrimaryButton>
            </div>
          </div>

          {/* Safety & Architecture Information Banner */}
          <div className="p-4 rounded-2xl bg-cream border border-archBorder/70 text-xs text-ink-muted flex items-start gap-3 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-800 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-espresso text-sm">
                Safe Consistent Snapshots & Transactional Staged Recovery
              </p>
              <p className="leading-relaxed">
                Backups utilize SQLite's native point-in-time snapshot engine to guarantee uncorrupted database archives even during active studio use. Restoring an archive triggers an automatic safety backup of your existing workspace before applying changes, ensuring zero data loss if an archive is damaged.
              </p>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="p-5 rounded-3xl bg-cream border border-archBorder/70 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-lg font-semibold text-espresso">
                  Verified Studio Backup Archives
                </h4>
                <p className="text-xs text-ink-muted">
                  Physical archives stored on your local disk ({autoDestination || 'Local AppData'}).
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={loadData}
                title="Refresh list"
              >
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="py-12">
                <LoadingState message="Scanning local backup storage directory..." />
              </div>
            ) : backups.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-dashed border-archBorder/60 bg-cream/40 p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-beige/50 text-espresso mx-auto flex items-center justify-center">
                  <Archive className="w-6 h-6" />
                </div>
                <h5 className="font-serif text-base font-semibold text-espresso">No Local Backups Found</h5>
                <p className="text-xs text-ink-muted max-w-sm mx-auto">
                  Your studio data is currently saved only in your active SQLite database. Create your first backup snapshot to protect your drawings, projects, and AI consultations.
                </p>
                <div className="pt-2">
                  <PrimaryButton
                    size="sm"
                    icon={<Archive className="w-3.5 h-3.5" />}
                    onClick={handleCreateBackup}
                    disabled={isCreating}
                  >
                    Create Initial Studio Backup
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-archBorder/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-beige/40 text-taupe font-mono uppercase text-[11px] border-b border-archBorder/50">
                    <tr>
                      <th className="px-4 py-3">Archive Filename</th>
                      <th className="px-4 py-3">Date Created</th>
                      <th className="px-4 py-3">Archive Size</th>
                      <th className="px-4 py-3">Files Included</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-archBorder/30">
                    {backups.map((bkp) => (
                      <tr key={bkp.filename} className="hover:bg-cream-light/60 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-medium text-espresso">
                          <div className="flex items-center gap-2">
                            <Archive className="w-4 h-4 text-taupe flex-shrink-0" />
                            <span className="truncate max-w-[240px]" title={bkp.filename}>
                              {bkp.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-ink-muted">
                          {new Date(bkp.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-ink-muted">
                          {formatBytes(bkp.sizeBytes)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-ink-muted">
                          {bkp.fileCount > 0 ? `${bkp.fileCount} files` : 'Full database'}
                        </td>
                        <td className="px-4 py-3.5">
                          {bkp.integrityOk ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verified OK</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Check Needed</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleVerifyBackup(bkp.filename)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/50 transition-colors"
                              title="Verify archive integrity and checksums"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => apiClient.downloadBackup(bkp.filename)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/50 transition-colors"
                              title="Download backup archive (.zip)"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRestoreTarget({
                                  filename: bkp.filename,
                                  manifest: bkp.manifest,
                                  sizeBytes: bkp.sizeBytes,
                                });
                              }}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-amber-800 hover:bg-amber-50 transition-colors"
                              title="Restore workspace from this backup"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingFilename(bkp.filename)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-rose-800 hover:bg-rose-50 transition-colors"
                              title="Delete backup"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: GOOGLE DRIVE CLOUD BACKUP                               */}
      {/* ============================================================== */}
      {activeTab === 'cloud' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-archBorder/40">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif text-xl sm:text-2xl font-semibold text-espresso">
                  Google Drive Cloud Backup
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Strict Zero-Cost Tier
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-sand/60 text-espresso border border-archBorder">
                  drive.file scope (No Billing Required)
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Store remote architectural snapshots directly inside your designated Google Drive folder.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {gdriveStatus?.connected && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<FolderCheck className="w-3.5 h-3.5" />}
                    onClick={() => handleVerifyFolder()}
                    disabled={isVerifyingFolder}
                    title="Verify read/write permissions for destination folder"
                  >
                    {isVerifyingFolder ? 'Verifying Folder...' : 'Verify Folder'}
                  </Button>

                  <PrimaryButton
                    size="sm"
                    icon={<Cloud className="w-3.5 h-3.5" />}
                    onClick={handleUploadCloudBackup}
                    disabled={isUploadingCloud || gdriveStatus.folderStatus !== 'verified'}
                    title={
                      gdriveStatus.folderStatus !== 'verified'
                        ? 'Verify folder write permissions first'
                        : 'Snapshot and upload backup to Google Drive'
                    }
                  >
                    {isUploadingCloud ? 'Uploading to Drive...' : 'Upload Cloud Backup'}
                  </PrimaryButton>
                </>
              )}
            </div>
          </div>

          {/* Strict Zero-Cost Policy Notice */}
          <div className="p-3.5 rounded-2xl bg-parchment/60 border border-archBorder/60 text-xs text-ink-muted flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-espresso font-semibold">Strict Zero-Cost Guarantee:</strong> Archora operates exclusively on Google's free OAuth 2.0 Drive quota (up to 1 billion requests/day). No Google Cloud billing account, credit card, or payment activation is ever required. If billing is ever demanded, cloud backups automatically pause to protect you from unexpected charges. Local backups remain 100% free and functional forever.
            </p>
          </div>

          {/* Account & Folder Status Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Connected Google Account */}
            <div className="p-5 rounded-3xl bg-cream border border-archBorder/70 shadow-sm space-y-3">
              <span className="text-[11px] font-mono uppercase text-taupe font-semibold">
                Google Account Connection
              </span>

              {gdriveStatus?.connected ? (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    {gdriveStatus.googlePicture ? (
                      <img
                        src={gdriveStatus.googlePicture}
                        alt="Google Account"
                        className="w-10 h-10 rounded-full border border-archBorder/60"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-espresso text-cream flex items-center justify-center font-serif text-sm font-semibold">
                        {gdriveStatus.googleName?.substring(0, 2).toUpperCase() || 'GA'}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-espresso">
                        {gdriveStatus.googleName || 'Google Account'}
                      </p>
                      <p className="text-xs text-ink-muted font-mono">{gdriveStatus.googleEmail}</p>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDisconnectConfirmOpen(true)}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-ink-muted">
                    No Google account connected. Authorize Archora with the minimum practical <code className="font-mono text-espresso font-semibold">drive.file</code> scope to upload backups directly to your folder.
                  </p>
                  {!gdriveStatus?.configured && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                      Google OAuth credentials (<code className="font-mono">GOOGLE_CLIENT_ID</code> / <code className="font-mono">GOOGLE_CLIENT_SECRET</code>) must be configured in your backend <code className="font-mono">.env</code> to connect live accounts.
                    </div>
                  )}
                  <PrimaryButton
                    size="sm"
                    icon={<Cloud className="w-3.5 h-3.5" />}
                    onClick={handleConnectGoogle}
                  >
                    Connect Google Account
                  </PrimaryButton>
                </div>
              )}
            </div>

            {/* Card 2: Destination Folder */}
            <div className="p-5 rounded-3xl bg-cream border border-archBorder/70 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-taupe font-semibold">
                  Designated Destination Folder
                </span>
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(true)}
                  className="text-[11px] text-espresso hover:underline font-mono"
                >
                  Change Folder
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-espresso">
                    <Folder className="w-4 h-4 text-taupe" />
                    <span className="truncate">
                      {gdriveStatus?.folderName || 'Designated Google Drive Folder'}
                    </span>
                  </div>

                  <a
                    href={`https://drive.google.com/drive/folders/${gdriveStatus?.folderId || DEFAULT_FOLDER_ID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-espresso hover:underline"
                    title="Open in Google Drive"
                  >
                    <span>Open in Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-2 rounded-xl bg-cream-light border border-archBorder/60 font-mono text-[11px] text-ink-muted truncate">
                  ID: {gdriveStatus?.folderId || DEFAULT_FOLDER_ID}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-ink-muted">Folder Status:</span>
                  {gdriveStatus?.folderStatus === 'verified' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified & Writable</span>
                    </span>
                  ) : gdriveStatus?.folderStatus === 'permission_denied' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Permission Denied (Read-only)</span>
                    </span>
                  ) : gdriveStatus?.folderStatus === 'inaccessible' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-100 text-rose-800 border border-rose-300">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Folder Inaccessible</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-beige text-espresso border border-archBorder/70">
                      <span>Unverified (Click Verify)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cloud Backups Table */}
          <div className="p-5 rounded-3xl bg-cream border border-archBorder/70 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif text-lg font-semibold text-espresso">
                  Remote Cloud Snapshots
                </h4>
                <p className="text-xs text-ink-muted">
                  Authentic backup archives stored inside folder <code className="font-mono font-medium">{gdriveStatus?.folderId || DEFAULT_FOLDER_ID}</code>.
                </p>
              </div>

              {gdriveStatus?.connected && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={loadGoogleDriveData}
                  disabled={isLoadingCloud}
                  title="Refresh cloud backup list"
                >
                  Refresh
                </Button>
              )}
            </div>

            {isLoadingCloud ? (
              <div className="py-12">
                <LoadingState message="Connecting to Google Drive folder..." />
              </div>
            ) : !gdriveStatus?.connected ? (
              <div className="py-12 text-center rounded-2xl border border-dashed border-archBorder/60 bg-cream/40 p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-beige/50 text-espresso mx-auto flex items-center justify-center">
                  <Cloud className="w-6 h-6" />
                </div>
                <h5 className="font-serif text-base font-semibold text-espresso">
                  Google Drive Disconnected
                </h5>
                <p className="text-xs text-ink-muted max-w-sm mx-auto">
                  Connect your Google account above to upload and synchronize architectural backups with your designated Drive folder.
                </p>
                <div className="pt-2">
                  <PrimaryButton
                    size="sm"
                    icon={<Cloud className="w-3.5 h-3.5" />}
                    onClick={handleConnectGoogle}
                  >
                    Connect Google Account
                  </PrimaryButton>
                </div>
              </div>
            ) : cloudBackups.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-dashed border-archBorder/60 bg-cream/40 p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-beige/50 text-espresso mx-auto flex items-center justify-center">
                  <Cloud className="w-6 h-6" />
                </div>
                <h5 className="font-serif text-base font-semibold text-espresso">
                  No Cloud Backups in this Folder
                </h5>
                <p className="text-xs text-ink-muted max-w-sm mx-auto">
                  The Google Drive folder currently contains zero Archora backup archives. Click 'Upload Cloud Backup' above to create your first remote snapshot.
                </p>
                <div className="pt-2">
                  <PrimaryButton
                    size="sm"
                    icon={<Cloud className="w-3.5 h-3.5" />}
                    onClick={handleUploadCloudBackup}
                    disabled={isUploadingCloud || gdriveStatus.folderStatus !== 'verified'}
                  >
                    {isUploadingCloud ? 'Uploading...' : 'Create Initial Cloud Backup'}
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-archBorder/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-beige/40 text-taupe font-mono uppercase text-[11px] border-b border-archBorder/50">
                    <tr>
                      <th className="px-4 py-3">Archive Filename</th>
                      <th className="px-4 py-3">Uploaded To Drive</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-archBorder/30">
                    {cloudBackups.map((bkp) => (
                      <tr key={bkp.fileId} className="hover:bg-cream-light/60 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-medium text-espresso">
                          <div className="flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-taupe flex-shrink-0" />
                            <span className="truncate max-w-[240px]" title={bkp.filename}>
                              {bkp.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-ink-muted">
                          {new Date(bkp.uploadedAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-ink-muted">
                          {formatBytes(bkp.sizeBytes)}
                        </td>
                        <td className="px-4 py-3.5">
                          {bkp.webViewLink ? (
                            <a
                              href={bkp.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-espresso hover:underline"
                            >
                              <span>View in Drive</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] font-mono text-ink-muted">Configured Folder</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleVerifyCloudBackup(bkp.fileId, bkp.filename)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/50 transition-colors"
                              title="Download & verify archive integrity"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => apiClient.downloadCloudBackup(bkp.fileId, bkp.filename)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/50 transition-colors"
                              title="Download backup archive (.zip) from Google Drive"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRestoreTarget({
                                  cloudFileId: bkp.fileId,
                                  filename: bkp.filename,
                                  sizeBytes: bkp.sizeBytes,
                                });
                              }}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-amber-800 hover:bg-amber-50 transition-colors"
                              title="Restore studio workspace from this cloud backup"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingCloudItem({ fileId: bkp.fileId, filename: bkp.filename })}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-rose-800 hover:bg-rose-50 transition-colors"
                              title="Delete from Google Drive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: RESTORE CONFIRMATION DIALOG                           */}
      {/* ============================================================== */}
      <Modal
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        title="Confirm Workspace Restoration"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-800" />
              <span>Workspace Replacement Warning</span>
            </div>
            <p className="leading-relaxed">
              Restoring from <strong className="font-mono">{restoreTarget?.filename}</strong> will replace your active database and drawings with the contents of this archive.
            </p>
            <p className="font-medium text-emerald-900 bg-emerald-50/80 p-2 rounded-xl border border-emerald-200">
              🛡️ An automatic safety snapshot of your current workspace will be created before any changes are applied. If restoration fails or the archive is corrupt, your workspace will automatically roll back.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-cream border border-archBorder/60 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-taupe">Archive Name:</span>
              <span className="text-espresso font-semibold truncate max-w-[220px]">
                {restoreTarget?.filename}
              </span>
            </div>
            {restoreTarget?.sizeBytes && (
              <div className="flex justify-between">
                <span className="text-taupe">Archive Size:</span>
                <span className="text-ink">{formatBytes(restoreTarget.sizeBytes)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-taupe">Restore Type:</span>
              <span className="text-ink">
                {restoreTarget?.cloudFileId
                  ? 'Google Drive Cloud Download & Staged Restore'
                  : restoreTarget?.file
                  ? 'Uploaded Archive Staged Restore'
                  : 'Local Archive Staged Restore'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-archBorder/40">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRestoreTarget(null)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <PrimaryButton
              size="sm"
              onClick={handleExecuteRestore}
              disabled={isRestoring}
            >
              {isRestoring ? 'Restoring Workspace...' : 'Confirm & Restore'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 2: ARCHIVE INTEGRITY VERIFICATION DETAILS                */}
      {/* ============================================================== */}
      <Modal
        isOpen={Boolean(verifyingItem)}
        onClose={() => setVerifyingItem(null)}
        title="Backup Integrity & Checksum Verification"
        maxWidth="md"
      >
        <div className="space-y-4">
          {verifyingItem?.loading ? (
            <div className="py-8">
              <LoadingState message={`Verifying checksums and schema for ${verifyingItem.filename}...`} />
            </div>
          ) : verifyingItem?.result ? (
            <div className="space-y-3 text-xs">
              <div className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                verifyingItem.result.valid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}>
                {verifyingItem.result.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-700 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {verifyingItem.result.valid
                      ? 'Integrity Verified: Archive Authentic & Uncorrupted'
                      : 'Integrity Check Failed'}
                  </p>
                  <p className="text-[11px] opacity-90">
                    {verifyingItem.result.valid
                      ? 'All cryptographic SHA-256 file hashes match manifest expectations.'
                      : verifyingItem.result.errors?.join('; ') || 'Checksum or manifest mismatch.'}
                  </p>
                </div>
              </div>

              {verifyingItem.result.manifest && (
                <div className="p-3.5 rounded-xl bg-cream border border-archBorder/60 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-taupe">App Version:</span>
                    <span className="text-espresso font-semibold">
                      Archora v{verifyingItem.result.manifest.appVersion || '1.0.0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-taupe">Schema Version:</span>
                    <span className="text-ink">
                      Migration #{verifyingItem.result.manifest.databaseSchemaVersion || 7}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-taupe">Total Files in Archive:</span>
                    <span className="text-ink">{verifyingItem.result.manifest.fileCount}</span>
                  </div>
                  {verifyingItem.result.manifest.metadata && (
                    <div className="pt-2 border-t border-archBorder/30 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-taupe">Saved Projects:</span>
                        <span className="text-espresso font-semibold">
                          {verifyingItem.result.manifest.metadata.projectCount || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-taupe">Architectural Drawings:</span>
                        <span className="text-espresso font-semibold">
                          {verifyingItem.result.manifest.metadata.filesCount || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-taupe">AI Tutor Conversations:</span>
                        <span className="text-espresso font-semibold">
                          {verifyingItem.result.manifest.metadata.conversationCount || 0}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-archBorder/40">
                <Button variant="secondary" size="sm" onClick={() => setVerifyingItem(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: CONFIGURE DESTINATION FOLDER MODAL                    */}
      {/* ============================================================== */}
      <Modal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        title="Google Drive Destination Folder"
        maxWidth="md"
      >
        <form onSubmit={handleSaveCustomFolder} className="space-y-4 text-xs">
          <p className="text-ink-muted leading-relaxed">
            Specify the Google Drive folder ID where all Archora cloud snapshots will be uploaded. The preferred destination provided by your studio is pre-filled below.
          </p>

          <FormField label="Google Drive Folder ID" required>
            <input
              type="text"
              value={customFolderId}
              onChange={(e) => setCustomFolderId(e.target.value)}
              placeholder="e.g. 1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl"
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </FormField>

          <div className="p-3 rounded-xl bg-beige/40 border border-archBorder/50 space-y-1 text-ink-muted">
            <span className="font-semibold text-espresso block">Preferred Studio Destination:</span>
            <code className="font-mono text-espresso select-all break-all">{DEFAULT_FOLDER_ID}</code>
            <p className="pt-1">
              Ensure your signed-in Google account has been granted <strong className="font-semibold text-espresso">Editor</strong> access to this folder.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-archBorder/40">
            <Button variant="secondary" size="sm" onClick={() => setIsFolderModalOpen(false)}>
              Cancel
            </Button>
            <PrimaryButton type="submit" size="sm">
              Save & Verify Folder
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 4: AUTOMATIC BACKUP SETTINGS                             */}
      {/* ============================================================== */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Automatic Studio Backup Settings"
        maxWidth="md"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cream border border-archBorder/60">
            <div>
              <h5 className="font-semibold text-espresso text-xs">Enable Automatic Backups</h5>
              <p className="text-ink-muted text-[11px] mt-0.5">
                Automatically generate snapshots in the background.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-archBorder text-espresso focus:ring-espresso"
            />
          </div>

          <FormField label="Backup Schedule Frequency">
            <select
              value={autoFrequency}
              onChange={(e) => setAutoFrequency(e.target.value as any)}
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none"
            >
              <option value="daily">Daily Studio Snapshot</option>
              <option value="weekly">Weekly Studio Archive</option>
              <option value="manual">Manual Only</option>
            </select>
          </FormField>

          <FormField label="Maximum Retained Archives (Auto-pruning)">
            <input
              type="number"
              min={1}
              max={50}
              value={autoMaxRetained}
              onChange={(e) => setAutoMaxRetained(parseInt(e.target.value, 10) || 5)}
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs font-mono text-ink focus:outline-none"
            />
          </FormField>

          <div className="p-3 rounded-xl bg-beige/30 border border-archBorder/40 text-[11px] font-mono text-ink-muted space-y-1">
            <div className="flex justify-between">
              <span>Local Storage Location:</span>
              <span className="text-espresso font-semibold truncate max-w-[200px]" title={autoDestination}>
                {autoDestination || 'AppData/Local/Archora/backups'}
              </span>
            </div>
            {autoLastRun && (
              <div className="flex justify-between">
                <span>Last Automated Run:</span>
                <span className="text-ink">{new Date(autoLastRun).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-archBorder/40">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSettingsOpen(false)}
              disabled={isSavingSettings}
            >
              Cancel
            </Button>
            <PrimaryButton type="submit" size="sm" disabled={isSavingSettings}>
              {isSavingSettings ? 'Saving...' : 'Save Configuration'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* CONFIRM DIALOGS                                                */}
      {/* ============================================================== */}
      <ConfirmDialog
        isOpen={Boolean(deletingFilename)}
        onClose={() => setDeletingFilename(null)}
        onConfirm={handleDeleteBackup}
        title="Delete Local Backup Archive?"
        message={`Are you sure you want to permanently delete "${deletingFilename}" from your disk? This action cannot be undone.`}
        confirmLabel="Delete Archive"
        isDestructive
      />

      <ConfirmDialog
        isOpen={Boolean(deletingCloudItem)}
        onClose={() => setDeletingCloudItem(null)}
        onConfirm={handleDeleteCloudBackup}
        title="Delete Google Drive Backup?"
        message={`Are you sure you want to permanently delete "${deletingCloudItem?.filename}" from your Google Drive folder?`}
        confirmLabel="Delete from Drive"
        isDestructive
      />

      <ConfirmDialog
        isOpen={disconnectConfirmOpen}
        onClose={() => setDisconnectConfirmOpen(false)}
        onConfirm={handleDisconnectGoogle}
        title="Disconnect Google Drive?"
        message="This will revoke and remove your stored Google credentials from Archora. Your existing Google Drive folder and local backups will not be modified."
        confirmLabel="Disconnect Account"
        isDestructive
      />
    </div>
  );
};
