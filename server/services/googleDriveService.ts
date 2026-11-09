import type { drive_v3 } from 'googleapis';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { googleOAuthRepository } from '../repositories/googleOAuthRepository';
import { cloudBackupRepository } from '../repositories/cloudBackupRepository';
import { settingsRepository, DEFAULT_GOOGLE_DRIVE_FOLDER_ID } from '../repositories/settingsRepository';
import { backupService } from './backupService';
import { getTempDirectory } from './fileStorageService';
import {
  GoogleDriveFolderInfo,
  GoogleDriveStatus,
  CloudBackupItem,
  CloudBackupRecord,
  BackupVerificationResult,
} from '../types/db';

const require = createRequire(import.meta.url);
let _google: any = null;
function getGoogle() {
  if (!_google) {
    _google = require('googleapis').google;
  }
  return _google;
}

const OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file',
];

export const googleDriveService = {
  /**
   * Determines if Google OAuth credentials have been supplied in environment.
   */
  isConfigured(): boolean {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    return Boolean(clientId && clientSecret && !clientId.includes('YOUR_GOOGLE_CLIENT_ID'));
  },

  /**
   * Constructs an OAuth2 client instance.
   */
  getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/callback';

    const g = getGoogle();
    return new g.auth.OAuth2(clientId, clientSecret, redirectUri);
  },

  /**
   * Generates Google OAuth authorization URL.
   */
  generateAuthUrl(state?: string): string {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env file.');
    }

    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Ensures refresh_token is consistently returned
      scope: OAUTH_SCOPES,
      state: state || 'archora_oauth_state',
    });
  },

  /**
   * Exchanges authorization code for tokens and saves them in SQLite.
   */
  async handleCallback(code: string, userId: string): Promise<{
    email: string | null;
    name: string | null;
    folderVerified: boolean;
  }> {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Retrieve user profile information
    let email: string | null = null;
    let name: string | null = null;
    let picture: string | null = null;

    try {
      const g = getGoogle();
      const oauth2 = g.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      email = userInfo.data.email || null;
      name = userInfo.data.name || null;
      picture = userInfo.data.picture || null;
    } catch (e) {
      console.warn('[GoogleDrive] Could not fetch user profile info:', e);
    }

    // Persist OAuth tokens securely in SQLite
    googleOAuthRepository.saveTokens({
      userId,
      googleEmail: email,
      googleName: name,
      googlePicture: picture,
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || null,
      tokenExpiry: tokens.expiry_date || null,
      scope: tokens.scope || null,
    });

    // Attempt to verify the default existing folder right after connection
    const settings = settingsRepository.get(userId);
    const targetFolderId = settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;

    let folderVerified = false;
    try {
      const folderInfo = await this.verifyFolder(userId, targetFolderId);
      folderVerified = folderInfo.exists && folderInfo.canAddChildren;
    } catch (err: any) {
      console.warn('[GoogleDrive] Initial folder verification after OAuth:', err.message);
    }

    return {
      email,
      name,
      folderVerified,
    };
  },

  /**
   * Prepares an authenticated Drive client for a user, automatically refreshing expired tokens.
   * If the current user has not personally connected Google, it seamlessly falls back to
   * the Studio Owner's master Google connection to write directly into the designated shared folder.
   */
  async getDriveClient(userId: string): Promise<drive_v3.Drive> {
    let tokens = googleOAuthRepository.getTokens(userId);
    let targetUserId = userId;

    if (!tokens || !tokens.access_token) {
      const masterTokens = googleOAuthRepository.getMasterTokens();
      if (masterTokens && masterTokens.access_token) {
        tokens = masterTokens;
        targetUserId = masterTokens.user_id;
      }
    }

    if (!tokens || !tokens.access_token) {
      throw new Error('Google account not connected. Please connect your Google account in Settings.');
    }

    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.token_expiry || undefined,
    });

    // Listen to token refresh events and persist new access token to SQLite
    oauth2Client.on('tokens', (newTokens) => {
      if (newTokens.access_token) {
        googleOAuthRepository.updateAccessToken(
          targetUserId,
          newTokens.access_token,
          newTokens.expiry_date || Date.now() + 3600 * 1000
        );
      }
    });

    // Proactively verify / refresh if expired
    if (tokens.token_expiry && Date.now() >= tokens.token_expiry - 60000) {
      if (tokens.refresh_token) {
        try {
          const refreshed = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(refreshed.credentials);
          if (refreshed.credentials.access_token) {
            googleOAuthRepository.updateAccessToken(
              targetUserId,
              refreshed.credentials.access_token,
              refreshed.credentials.expiry_date || Date.now() + 3600 * 1000
            );
          }
        } catch (refreshErr: any) {
          throw new Error(`Google authorization expired and could not be refreshed (${refreshErr.message}). Please reconnect your Google account.`);
        }
      } else {
        throw new Error('Google authorization expired and no refresh token is stored. Please reconnect your Google account.');
      }
    }

    const g = getGoogle();
    return g.drive({ version: 'v3', auth: oauth2Client });
  },

  /**
   * Retrieves high-level connection and folder status.
   */
  async getStatus(userId: string): Promise<GoogleDriveStatus> {
    const configured = this.isConfigured();
    let tokens = googleOAuthRepository.getTokens(userId);
    let isMaster = false;

    if (!tokens) {
      const masterTokens = googleOAuthRepository.getMasterTokens();
      if (masterTokens && masterTokens.access_token) {
        tokens = masterTokens;
        isMaster = true;
      }
    }

    const settings = settingsRepository.get(userId);
    const folderId = settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;

    if (!configured || !tokens) {
      return {
        configured,
        connected: false,
        folderId,
        folderName: settings.google_drive_folder_name || null,
        folderStatus: (settings.google_drive_folder_status as any) || 'unverified',
        canUpload: false,
        lastVerified: settings.google_drive_last_verified || null,
        lastBackup: settings.google_drive_last_backup || null,
        googlePickerApiKeyConfigured: Boolean(process.env.GOOGLE_PICKER_API_KEY),
      };
    }

    return {
      configured,
      connected: true,
      googleEmail: isMaster ? `${tokens.google_email} (Studio Cloud)` : tokens.google_email,
      googleName: isMaster ? `${tokens.google_name} (Studio Master)` : tokens.google_name,
      googlePicture: tokens.google_picture,
      folderId,
      folderName: settings.google_drive_folder_name || 'Archora Studio Drive',
      folderStatus: (settings.google_drive_folder_status as any) || 'verified',
      canUpload: true,
      lastVerified: settings.google_drive_last_verified || null,
      lastBackup: settings.google_drive_last_backup || null,
      googlePickerApiKeyConfigured: Boolean(process.env.GOOGLE_PICKER_API_KEY),
    };
  },

  /**
   * Verifies access, retrieves metadata, and tests write permissions for the specified folder.
   */
  async verifyFolder(userId: string, targetFolderId?: string): Promise<GoogleDriveFolderInfo> {
    const drive = await this.getDriveClient(userId);
    const settings = settingsRepository.get(userId);
    const folderId = targetFolderId || settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;

    try {
      const res = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType, trashed, capabilities, webViewLink',
        supportsAllDrives: true,
      });

      const file = res.data;
      if (!file || !file.id) {
        throw new Error(`Google Drive folder with ID "${folderId}" was not found.`);
      }

      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      if (!isFolder) {
        settingsRepository.upsert(userId, {
          google_drive_folder_id: folderId,
          google_drive_folder_name: file.name || 'Not a folder',
          google_drive_folder_status: 'inaccessible',
          google_drive_last_verified: new Date().toISOString(),
        });
        return {
          id: folderId,
          name: file.name || '',
          exists: true,
          isFolder: false,
          trashed: Boolean(file.trashed),
          canAddChildren: false,
          error: `The provided Drive item "${file.name}" is a file, not a folder. Please select a valid folder.`,
        };
      }

      if (file.trashed) {
        settingsRepository.upsert(userId, {
          google_drive_folder_id: folderId,
          google_drive_folder_name: file.name || '',
          google_drive_folder_status: 'inaccessible',
          google_drive_last_verified: new Date().toISOString(),
        });
        return {
          id: folderId,
          name: file.name || '',
          exists: true,
          isFolder: true,
          trashed: true,
          canAddChildren: false,
          error: `The folder "${file.name}" is in the Google Drive trash. Please restore it or select an active folder.`,
        };
      }

      const canAddChildren = Boolean(file.capabilities?.canAddChildren);
      const folderStatus = canAddChildren ? 'verified' : 'permission_denied';

      settingsRepository.upsert(userId, {
        google_drive_folder_id: folderId,
        google_drive_folder_name: file.name || '',
        google_drive_folder_status: folderStatus,
        google_drive_last_verified: new Date().toISOString(),
      });

      return {
        id: file.id,
        name: file.name || 'Google Drive Folder',
        exists: true,
        isFolder: true,
        trashed: false,
        canAddChildren,
        webViewLink: file.webViewLink || undefined,
        error: canAddChildren ? undefined : 'Your Google account does not have write permissions to create files inside this folder.',
      };
    } catch (err: any) {
      const errMsg = err.message || 'Unknown Google Drive error';
      let userFriendlyError = errMsg;

      if (errMsg.toLowerCase().includes('billing')) {
        userFriendlyError = `Google Cloud billing is required by this project. In adherence to Archora's Strict Zero-Cost Policy, cloud backups are automatically disabled to prevent any unexpected charges. Local Backup & Restore is 100% free and fully functional.`;
      } else if (err.code === 404 || errMsg.includes('File not found') || errMsg.includes('404')) {
        userFriendlyError = `Folder ID "${folderId}" was not found in your Google account. Ensure you have opened or been granted access to this folder, or select it via Google Picker.`;
      } else if (err.code === 403 || errMsg.includes('permission') || errMsg.includes('403')) {
        userFriendlyError = `Access to folder ID "${folderId}" is denied by Google Drive. Ensure the folder is shared with your signed-in Google account with Editor permissions.`;
      }

      settingsRepository.upsert(userId, {
        google_drive_folder_id: folderId,
        google_drive_folder_status: 'inaccessible',
        google_drive_last_verified: new Date().toISOString(),
      });

      return {
        id: folderId,
        name: '',
        exists: false,
        isFolder: false,
        trashed: false,
        canAddChildren: false,
        error: userFriendlyError,
      };
    }
  },

  /**
   * Sets a new preferred destination folder ID for cloud backups.
   */
  async setDestinationFolder(userId: string, folderId: string, folderName?: string): Promise<GoogleDriveFolderInfo> {
    const trimmedId = folderId.trim();
    if (!trimmedId) {
      throw new Error('Folder ID cannot be empty.');
    }

    settingsRepository.upsert(userId, {
      google_drive_folder_id: trimmedId,
      google_drive_folder_name: folderName || null,
      google_drive_folder_status: 'unverified',
    });

    return this.verifyFolder(userId, trimmedId);
  },

  /**
   * Uploads an atomic Archora backup directly into the configured Google Drive folder.
   */
  async uploadBackup(userId: string, options: {
    folderId?: string;
    customFilename?: string;
  } = {}): Promise<{
    cloudBackup: CloudBackupRecord;
    webViewLink?: string;
  }> {
    const settings = settingsRepository.get(userId);
    const folderId = options.folderId || settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;

    // Verify folder write capability before creating backup
    const folderInfo = await this.verifyFolder(userId, folderId);
    if (!folderInfo.exists || !folderInfo.canAddChildren) {
      throw new Error(`Cannot upload backup: ${folderInfo.error || 'The designated Google Drive folder is not writable.'}`);
    }

    // Step 1: Create local backup archive with SHA-256 validation
    const localBackupResult = await backupService.createBackup({
      userId,
      isAutomatic: false,
      customFilename: options.customFilename,
    });

    const localZipPath = localBackupResult.filePath;
    const filename = path.basename(localZipPath);
    const fileStats = fs.statSync(localZipPath);

    // Step 2: Upload archive stream to the verified Google Drive folder
    const drive = await this.getDriveClient(userId);

    let driveFile;
    try {
      const res = await drive.files.create({
        requestBody: {
          name: filename,
          parents: [folderId],
          description: `Archora studio backup snapshot (${localBackupResult.manifest.fileCount} files, created ${localBackupResult.manifest.createdAt})`,
        },
        media: {
          mimeType: 'application/zip',
          body: fs.createReadStream(localZipPath),
        },
        fields: 'id, name, size, md5Checksum, createdTime, webViewLink',
        supportsAllDrives: true,
      });
      driveFile = res.data;
    } catch (uploadErr: any) {
      const msg = uploadErr.message || '';
      if (msg.toLowerCase().includes('billing')) {
        throw new Error(`Google Cloud billing is required by this project. In adherence to Archora's Strict Zero-Cost Policy, cloud backup upload was aborted to prevent unexpected charges. Please use Local Backup & Restore instead.`);
      }
      throw new Error(`Failed to upload backup to Google Drive folder (${folderId}): ${uploadErr.message}`);
    }

    if (!driveFile || !driveFile.id) {
      throw new Error('Upload completed but Google Drive did not return a valid file ID.');
    }

    // Step 3: Record cloud backup in SQLite
    const cloudBackup = cloudBackupRepository.createRecord({
      id: `cloud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      userId,
      localBackupId: localBackupResult.backup.id,
      googleDriveFileId: driveFile.id,
      googleDriveFolderId: folderId,
      filename,
      fileSizeBytes: fileStats.size,
      checksumSha256: localBackupResult.backup.checksum_sha256,
      fileCount: localBackupResult.manifest.fileCount,
      createdAt: localBackupResult.manifest.createdAt,
      uploadedAt: new Date().toISOString(),
    });

    // Update settings with last backup time
    settingsRepository.upsert(userId, {
      google_drive_last_backup: new Date().toISOString(),
    });

    return {
      cloudBackup,
      webViewLink: driveFile.webViewLink || undefined,
    };
  },

  /**
   * Lists genuine backup archives located inside the designated Google Drive folder.
   */
  async listBackups(userId: string, targetFolderId?: string): Promise<CloudBackupItem[]> {
    const drive = await this.getDriveClient(userId);
    const settings = settingsRepository.get(userId);
    const folderId = targetFolderId || settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;

    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
        fields: 'files(id, name, size, md5Checksum, createdTime, webViewLink)',
        orderBy: 'createdTime desc',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = res.data.files || [];
      const results: CloudBackupItem[] = [];

      for (const file of files) {
        if (!file.id || !file.name) continue;

        // Find matching local database record if tracked
        const dbRecord = cloudBackupRepository.findByFileId(file.id);

        results.push({
          id: dbRecord?.id || `drive_${file.id}`,
          fileId: file.id,
          filename: file.name,
          sizeBytes: parseInt(file.size || '0', 10),
          createdAt: file.createdTime || new Date().toISOString(),
          uploadedAt: dbRecord?.uploadedAt || file.createdTime || new Date().toISOString(),
          folderId,
          md5Checksum: file.md5Checksum || undefined,
          sha256Checksum: dbRecord?.checksum_sha256 || undefined,
          webViewLink: file.webViewLink || undefined,
        });
      }

      return results;
    } catch (err: any) {
      console.error('[GoogleDrive] List backups error:', err.message);
      throw new Error(`Failed to list backups from Google Drive folder (${folderId}): ${err.message}`);
    }
  },

  /**
   * Downloads a backup file from Google Drive into a local temporary file or Buffer.
   */
  async downloadBackup(userId: string, fileId: string): Promise<{
    buffer: Buffer;
    filename: string;
    size: number;
  }> {
    const drive = await this.getDriveClient(userId);

    // Get file metadata first
    const metaRes = await drive.files.get({
      fileId,
      fields: 'id, name, size, parents',
      supportsAllDrives: true,
    });
    const filename = metaRes.data.name || 'Archora-Cloud-Backup.zip';

    // Download file content stream
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(res.data as ArrayBuffer);
    return {
      buffer,
      filename,
      size: buffer.length,
    };
  },

  /**
   * Verifies the cryptographic and structural integrity of a backup in Google Drive.
   */
  async verifyCloudBackup(userId: string, fileId: string): Promise<BackupVerificationResult> {
    const downloaded = await this.downloadBackup(userId, fileId);
    return backupService.verifyBackup(downloaded.buffer);
  },

  /**
   * Restores workspace from a selected Google Drive backup using the staged 10-step safe engine.
   */
  async restoreFromCloudBackup(userId: string, fileId: string) {
    const downloaded = await this.downloadBackup(userId, fileId);

    // Write to a temporary isolated file on Drive D: to run restore
    const tempRestorePath = path.join(
      getTempDirectory(),
      `archora_cloud_restore_${Date.now()}_${downloaded.filename}`
    );
    fs.writeFileSync(tempRestorePath, downloaded.buffer);

    try {
      const result = await backupService.restoreBackup(tempRestorePath);
      return result;
    } finally {
      try {
        if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath);
      } catch (e) {}
    }
  },

  /**
   * Deletes a backup from the Google Drive folder.
   */
  async deleteCloudBackup(userId: string, fileId: string): Promise<boolean> {
    const drive = await this.getDriveClient(userId);

    try {
      await drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
    } catch (err: any) {
      if (err.code !== 404) {
        throw new Error(`Failed to delete backup from Google Drive: ${err.message}`);
      }
    }

    // Remove tracking record from SQLite
    cloudBackupRepository.deleteByFileId(fileId, userId);
    return true;
  },

  /**
   * Disconnects the user's Google account and revokes stored tokens.
   */
  async disconnect(userId: string): Promise<void> {
    const tokens = googleOAuthRepository.getTokens(userId);
    if (tokens?.access_token) {
      try {
        const oauth2Client = this.getOAuth2Client();
        await oauth2Client.revokeToken(tokens.access_token);
      } catch (e) {
        console.warn('[GoogleDrive] Token revocation error (proceeding with local cleanup):', e);
      }
    }

    googleOAuthRepository.deleteTokens(userId);
    settingsRepository.upsert(userId, {
      google_drive_folder_status: 'unverified',
    });
  },
};
