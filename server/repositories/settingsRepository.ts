import { getDb } from '../db/connection';
import { UserSettingsRecord } from '../types/db';

export const DEFAULT_GOOGLE_DRIVE_FOLDER_ID = '1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl';

export const settingsRepository = {
  get(userId: string): UserSettingsRecord {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM user_settings WHERE user_id = ?`).get(userId) as UserSettingsRecord | undefined;
    if (row) {
      if (!row.google_drive_folder_id) {
        row.google_drive_folder_id = DEFAULT_GOOGLE_DRIVE_FOLDER_ID;
      }
      return row;
    }

    // Default settings if not yet saved in SQLite
    const now = new Date().toISOString();
    return {
      user_id: userId,
      parchment_warmth: 'standard',
      high_contrast_mode: 0,
      reduced_motion: 0,
      font_size: 'standard',
      auto_save_interval_sec: 30,
      auto_backup_enabled: 0,
      auto_backup_frequency: 'daily',
      auto_backup_max_retained: 5,
      auto_backup_destination: null,
      auto_backup_last_run: null,
      google_drive_folder_id: DEFAULT_GOOGLE_DRIVE_FOLDER_ID,
      google_drive_folder_name: null,
      google_drive_folder_status: 'unverified',
      google_drive_last_verified: null,
      google_drive_last_backup: null,
      updated_at: now,
    };
  },

  getSettings(userId: string): UserSettingsRecord {
    return this.get(userId);
  },

  upsert(userId: string, updates: Partial<{
    parchment_warmth: 'soft' | 'standard' | 'deep';
    high_contrast_mode: boolean | number;
    reduced_motion: boolean | number;
    font_size: 'standard' | 'large';
    auto_save_interval_sec: number;
    auto_backup_enabled: boolean | number;
    auto_backup_frequency: string;
    auto_backup_max_retained: number;
    auto_backup_destination: string | null;
    auto_backup_last_run: string | null;
    google_drive_folder_id: string | null;
    google_drive_folder_name: string | null;
    google_drive_folder_status: 'unverified' | 'verified' | 'inaccessible' | 'permission_denied';
    google_drive_last_verified: string | null;
    google_drive_last_backup: string | null;
  }>): UserSettingsRecord {
    const db = getDb();
    const current = this.get(userId);
    const now = new Date().toISOString();

    const warmth = updates.parchment_warmth || current.parchment_warmth;
    const highContrast = updates.high_contrast_mode !== undefined ? (updates.high_contrast_mode ? 1 : 0) : current.high_contrast_mode;
    const reducedMotion = updates.reduced_motion !== undefined ? (updates.reduced_motion ? 1 : 0) : current.reduced_motion;
    const fontSize = updates.font_size || current.font_size;
    const autoSave = updates.auto_save_interval_sec !== undefined ? updates.auto_save_interval_sec : current.auto_save_interval_sec;

    const autoBackupEnabled = updates.auto_backup_enabled !== undefined
      ? (updates.auto_backup_enabled ? 1 : 0)
      : (current.auto_backup_enabled ?? 0);
    const autoBackupFreq = updates.auto_backup_frequency !== undefined
      ? updates.auto_backup_frequency
      : (current.auto_backup_frequency || 'daily');
    const autoBackupMax = updates.auto_backup_max_retained !== undefined
      ? updates.auto_backup_max_retained
      : (current.auto_backup_max_retained ?? 5);
    const autoBackupDest = updates.auto_backup_destination !== undefined
      ? updates.auto_backup_destination
      : (current.auto_backup_destination ?? null);
    const autoBackupLastRun = updates.auto_backup_last_run !== undefined
      ? updates.auto_backup_last_run
      : (current.auto_backup_last_run ?? null);

    const gDriveFolderId = updates.google_drive_folder_id !== undefined
      ? updates.google_drive_folder_id
      : (current.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID);
    const gDriveFolderName = updates.google_drive_folder_name !== undefined
      ? updates.google_drive_folder_name
      : (current.google_drive_folder_name ?? null);
    const gDriveStatus = updates.google_drive_folder_status !== undefined
      ? updates.google_drive_folder_status
      : (current.google_drive_folder_status || 'unverified');
    const gDriveLastVerified = updates.google_drive_last_verified !== undefined
      ? updates.google_drive_last_verified
      : (current.google_drive_last_verified ?? null);
    const gDriveLastBackup = updates.google_drive_last_backup !== undefined
      ? updates.google_drive_last_backup
      : (current.google_drive_last_backup ?? null);

    db.prepare(`
      INSERT INTO user_settings (
        user_id, parchment_warmth, high_contrast_mode, reduced_motion, font_size, auto_save_interval_sec,
        auto_backup_enabled, auto_backup_frequency, auto_backup_max_retained, auto_backup_destination, auto_backup_last_run,
        google_drive_folder_id, google_drive_folder_name, google_drive_folder_status, google_drive_last_verified, google_drive_last_backup,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        parchment_warmth = excluded.parchment_warmth,
        high_contrast_mode = excluded.high_contrast_mode,
        reduced_motion = excluded.reduced_motion,
        font_size = excluded.font_size,
        auto_save_interval_sec = excluded.auto_save_interval_sec,
        auto_backup_enabled = excluded.auto_backup_enabled,
        auto_backup_frequency = excluded.auto_backup_frequency,
        auto_backup_max_retained = excluded.auto_backup_max_retained,
        auto_backup_destination = excluded.auto_backup_destination,
        auto_backup_last_run = excluded.auto_backup_last_run,
        google_drive_folder_id = excluded.google_drive_folder_id,
        google_drive_folder_name = excluded.google_drive_folder_name,
        google_drive_folder_status = excluded.google_drive_folder_status,
        google_drive_last_verified = excluded.google_drive_last_verified,
        google_drive_last_backup = excluded.google_drive_last_backup,
        updated_at = excluded.updated_at
    `).run(
      userId, warmth, highContrast, reducedMotion, fontSize, autoSave,
      autoBackupEnabled, autoBackupFreq, autoBackupMax, autoBackupDest, autoBackupLastRun,
      gDriveFolderId, gDriveFolderName, gDriveStatus, gDriveLastVerified, gDriveLastBackup,
      now
    );

    return {
      user_id: userId,
      parchment_warmth: warmth,
      high_contrast_mode: highContrast,
      reduced_motion: reducedMotion,
      font_size: fontSize,
      auto_save_interval_sec: autoSave,
      auto_backup_enabled: autoBackupEnabled,
      auto_backup_frequency: autoBackupFreq,
      auto_backup_max_retained: autoBackupMax,
      auto_backup_destination: autoBackupDest,
      auto_backup_last_run: autoBackupLastRun,
      google_drive_folder_id: gDriveFolderId,
      google_drive_folder_name: gDriveFolderName,
      google_drive_folder_status: gDriveStatus,
      google_drive_last_verified: gDriveLastVerified,
      google_drive_last_backup: gDriveLastBackup,
      updated_at: now,
    };
  },

  updateSettings(userId: string, updates: any): UserSettingsRecord {
    return this.upsert(userId, updates);
  }
};
