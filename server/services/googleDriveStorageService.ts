import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Response } from 'express';
import { getDb, getDatabasePath } from '../db/connection';
import { googleDriveService } from './googleDriveService';
import { settingsRepository, DEFAULT_GOOGLE_DRIVE_FOLDER_ID } from '../repositories/settingsRepository';
import { fileRepository } from '../repositories/fileRepository';
import { projectRepository } from '../repositories/projectRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { savedOutputRepository } from '../repositories/savedOutputRepository';
import { syncRepository } from '../repositories/syncRepository';
import { removePhysicalFile, sanitizeFilename } from './fileStorageService';
import { ProjectFileRecord, WebsiteSyncSnapshot, CloudSyncStateRecord } from '../types/db';

export interface StorageOverview {
  localDatabaseBytes: number;
  localDatabaseFormatted: string;
  cloudFilesCount: number;
  cloudFilesSizeBytes: number;
  cloudFilesSizeFormatted: string;
  localFilesCount: number;
  localFilesSizeBytes: number;
  localFilesSizeFormatted: string;
  savedLocalDiskBytes: number;
  savedLocalDiskFormatted: string;
  freeDiskBytes: number;
  freeDiskFormatted: string;
  isLowDiskSpace: boolean; // true if free disk < 10 GB
  targetFolderId: string;
  folderVerified: boolean;
  googleConnected: boolean;
}

/**
 * Format bytes into human-readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export class GoogleDriveStorageService {
  /**
   * Uploads an architectural drawing, PDF, image, or document directly to Google Drive.
   * Under the Low Local Storage Strategy (<10 GB free), the physical file is unlinked locally
   * once verified on Google Drive, conserving local disk space.
   */
  async uploadProjectFile(
    userId: string,
    localFilePath: string,
    originalFilename: string,
    mimeType: string,
    options: {
      projectId?: string | null;
      category?: string;
      description?: string;
      removeLocalAfterUpload?: boolean;
    } = {}
  ): Promise<{
    fileRecord: ProjectFileRecord;
    uploadedToCloud: boolean;
    cloudFileId?: string;
    webViewLink?: string;
    thumbnailLink?: string;
    error?: string;
  }> {
    const removeLocal = options.removeLocalAfterUpload ?? true;
    const cleanFilename = sanitizeFilename(originalFilename);
    const ext = path.extname(cleanFilename).toLowerCase();
    const fileId = `file_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const fileSize = fs.existsSync(localFilePath) ? fs.statSync(localFilePath).size : 0;

    const settings = settingsRepository.get(userId);
    const folderId = settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;

    let drive: drive_v3.Drive | null = null;
    let isConnected = false;

    try {
      drive = await googleDriveService.getDriveClient(userId);
      isConnected = true;
    } catch {
      isConnected = false;
    }

    if (!isConnected || !drive) {
      // Offline or Google account not connected: store locally and mark pending upload
      const record = fileRepository.create({
        id: fileId,
        user_id: userId,
        project_id: options.projectId || null,
        original_filename: cleanFilename,
        storage_filename: path.basename(localFilePath),
        storage_path: localFilePath,
        mime_type: mimeType,
        file_extension: ext,
        file_size: fileSize,
        description: options.description || '',
        category: options.category || 'Other',
        cloud_storage_status: 'local',
      });

      return {
        fileRecord: record,
        uploadedToCloud: false,
        error: 'Google Drive is not connected. File saved locally in studio archive.',
      };
    }

    // Google Drive is connected: upload stream directly to the target folder
    try {
      const uploadRes = await drive.files.create({
        requestBody: {
          name: cleanFilename,
          parents: [folderId],
          description: `Archora studio file (${options.category || 'Architectural File'}, project: ${options.projectId || 'unassigned'})`,
        },
        media: {
          mimeType,
          body: fs.createReadStream(localFilePath),
        },
        fields: 'id, name, size, md5Checksum, webViewLink, thumbnailLink',
        supportsAllDrives: true,
      });

      const driveFile = uploadRes.data;
      if (!driveFile || !driveFile.id) {
        throw new Error('Google Drive upload succeeded but no file ID was returned.');
      }

      // If low local storage strategy is active, unlink local file
      let storagePath = localFilePath;
      let cloudStatus: 'cloud_only' | 'synced' = 'synced';

      if (removeLocal) {
        removePhysicalFile(localFilePath);
        storagePath = `gdrive://${driveFile.id}`;
        cloudStatus = 'cloud_only';
      }

      const record = fileRepository.create({
        id: fileId,
        user_id: userId,
        project_id: options.projectId || null,
        original_filename: cleanFilename,
        storage_filename: path.basename(localFilePath),
        storage_path: storagePath,
        mime_type: mimeType,
        file_extension: ext,
        file_size: driveFile.size ? parseInt(driveFile.size, 10) : fileSize,
        description: options.description || '',
        category: options.category || 'Other',
        google_drive_file_id: driveFile.id,
        cloud_storage_status: cloudStatus,
        cloud_web_view_link: driveFile.webViewLink || null,
        cloud_thumbnail_link: driveFile.thumbnailLink || null,
        cloud_md5_checksum: driveFile.md5Checksum || null,
      });

      return {
        fileRecord: record,
        uploadedToCloud: true,
        cloudFileId: driveFile.id,
        webViewLink: driveFile.webViewLink || undefined,
        thumbnailLink: driveFile.thumbnailLink || undefined,
      };
    } catch (uploadErr: any) {
      console.warn('[GoogleDriveStorage] Failed to upload to Google Drive:', uploadErr.message);

      // Save locally and queue for later retry
      const record = fileRepository.create({
        id: fileId,
        user_id: userId,
        project_id: options.projectId || null,
        original_filename: cleanFilename,
        storage_filename: path.basename(localFilePath),
        storage_path: localFilePath,
        mime_type: mimeType,
        file_extension: ext,
        file_size: fileSize,
        description: options.description || '',
        category: options.category || 'Other',
        cloud_storage_status: 'pending_upload',
      });

      syncRepository.enqueueOfflineAction(userId, 'file_upload', fileId, {
        fileId,
        localPath: localFilePath,
        originalFilename: cleanFilename,
        mimeType,
      });

      return {
        fileRecord: record,
        uploadedToCloud: false,
        error: `Upload to Google Drive failed (${uploadErr.message}). File retained locally and queued for synchronization.`,
      };
    }
  }

  /**
   * Streams a file from Google Drive directly to the Express response stream.
   * This allows viewing/downloading without keeping permanent copies on the local disk.
   */
  async streamFileFromDrive(
    userId: string,
    file: ProjectFileRecord,
    res: Response,
    options: { asAttachment?: boolean } = {}
  ): Promise<void> {
    if (!file.google_drive_file_id) {
      throw new Error('This file does not have an associated Google Drive file ID.');
    }

    const drive = await googleDriveService.getDriveClient(userId);

    const dispositionType = options.asAttachment ? 'attachment' : 'inline';
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${encodeURIComponent(file.original_filename)}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const driveStream = await drive.files.get(
      {
        fileId: file.google_drive_file_id,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'stream' }
    );

    driveStream.data.pipe(res);
  }

  /**
   * Deletes a file from both Google Drive and SQLite.
   */
  async deleteProjectFile(
    userId: string,
    fileId: string
  ): Promise<{ success: boolean; cloudDeleted: boolean; message: string }> {
    const file = fileRepository.findById(fileId, userId);
    if (!file) {
      throw new Error('File not found or access denied.');
    }

    let cloudDeleted = false;

    // 1. If stored in Google Drive, delete remote file
    if (file.google_drive_file_id) {
      try {
        const drive = await googleDriveService.getDriveClient(userId);
        await drive.files.delete({
          fileId: file.google_drive_file_id,
          supportsAllDrives: true,
        });
        cloudDeleted = true;
      } catch (err: any) {
        console.warn(`[GoogleDriveStorage] Remote delete failed for Drive ID ${file.google_drive_file_id}:`, err.message);
        // Queue remote deletion if network was unreachable
        syncRepository.enqueueOfflineAction(userId, 'file_delete', file.id, {
          googleDriveFileId: file.google_drive_file_id,
        });
      }
    }

    // 2. Remove physical file if on local disk
    if (file.storage_path && !file.storage_path.startsWith('gdrive://')) {
      removePhysicalFile(file.storage_path);
    }

    // 3. Remove SQLite record
    fileRepository.delete(fileId, userId);

    return {
      success: true,
      cloudDeleted,
      message: `File "${file.original_filename}" removed from studio archive.`,
    };
  }

  /**
   * Recursively sanitizes any data payload before sending to Google Drive.
   * STRICT SECURITY: Absolutely NO passwords, bcrypt hashes, API keys, session tokens, or secrets.
   */
  sanitizeSyncPayload<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;

    const SENSITIVE_KEYS = new Set([
      'password',
      'password_hash',
      'salt',
      'access_token',
      'refresh_token',
      'token_expiry',
      'session_token',
      'token',
      'secret',
      'gemini_api_key',
      'api_key',
      'google_client_secret',
      'session_id',
    ]);

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeSyncPayload(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          continue; // Strip sensitive key entirely
        }
        sanitized[key] = this.sanitizeSyncPayload(value);
      }
      return sanitized as T;
    }

    return obj;
  }

  /**
   * Generates a sanitized website data snapshot.
   */
  generateWebsiteDataSnapshot(userId: string): WebsiteSyncSnapshot {
    const db = getDb();
    const projects = projectRepository.findByUser(userId);
    const projectNotes = db.prepare('SELECT * FROM project_notes WHERE user_id = ?').all(userId) as any[];
    const conversations = conversationRepository.findConversationsByUser(userId);
    const messages = db.prepare('SELECT * FROM messages WHERE user_id = ?').all(userId) as any[];
    const savedOutputs = savedOutputRepository.findByUser(userId);
    const filesMetadata = fileRepository.findAllByUser(userId);
    const userSettings = settingsRepository.get(userId);

    const syncState = syncRepository.getSyncState(userId);
    const nextVersion = (syncState?.snapshot_version || 0) + 1;

    const rawSnapshot: WebsiteSyncSnapshot = {
      version: nextVersion,
      createdAt: new Date().toISOString(),
      studioName: 'Archora Architecture Studio',
      projects,
      projectNotes,
      conversations,
      messages,
      savedOutputs,
      filesMetadata,
      userSettings,
    };

    const sanitized = this.sanitizeSyncPayload(rawSnapshot);

    // Assert that sensitive fields are completely absent
    const serialized = JSON.stringify(sanitized);
    if (
      serialized.includes('password_hash') ||
      serialized.includes('access_token') ||
      serialized.includes('refresh_token')
    ) {
      throw new Error('SECURITY VIOLATION: Sensitive authentication credentials detected in website data snapshot.');
    }

    return sanitized;
  }

  /**
   * Uploads website data synchronization manifest to Google Drive folder 1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl.
   */
  async uploadWebsiteDataSnapshot(userId: string): Promise<{
    success: boolean;
    snapshotDriveFileId: string;
    version: number;
    syncedAt: string;
    totalSyncedProjects: number;
    totalSyncedConversations: number;
    totalSyncedFiles: number;
    webViewLink?: string;
  }> {
    const drive = await googleDriveService.getDriveClient(userId);
    const settings = settingsRepository.get(userId);
    const folderId = settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;

    // Verify destination folder permissions
    const folderInfo = await googleDriveService.verifyFolder(userId, folderId);
    if (!folderInfo.exists || !folderInfo.canAddChildren) {
      throw new Error(`Cannot synchronize website data: ${folderInfo.error || 'Destination Google Drive folder is not writable.'}`);
    }

    // Set sync status to syncing
    syncRepository.upsertSyncState(userId, { sync_status: 'syncing', error_message: null });

    try {
      const snapshot = this.generateWebsiteDataSnapshot(userId);
      const filename = `archora_sync_manifest_v${snapshot.version}_${Date.now()}.json`;
      const snapshotJson = JSON.stringify(snapshot, null, 2);

      const res = await drive.files.create({
        requestBody: {
          name: filename,
          parents: [folderId],
          description: `Archora studio data synchronization snapshot (v${snapshot.version}, ${snapshot.projects.length} projects, ${snapshot.conversations.length} conversations, ${snapshot.filesMetadata.length} files)`,
        },
        media: {
          mimeType: 'application/json',
          body: snapshotJson,
        },
        fields: 'id, name, size, webViewLink',
        supportsAllDrives: true,
      });

      const file = res.data;
      if (!file || !file.id) {
        throw new Error('Google Drive accepted snapshot upload but returned no file ID.');
      }

      const syncedAt = new Date().toISOString();
      const totalProjects = snapshot.projects.length;
      const totalConversations = snapshot.conversations.length;
      const totalFiles = snapshot.filesMetadata.length;

      // Update sync state in SQLite
      syncRepository.upsertSyncState(userId, {
        sync_status: 'synced',
        last_sync_at: syncedAt,
        snapshot_drive_file_id: file.id,
        snapshot_version: snapshot.version,
        total_synced_projects: totalProjects,
        total_synced_conversations: totalConversations,
        total_synced_files: totalFiles,
        error_message: null,
      });

      return {
        success: true,
        snapshotDriveFileId: file.id,
        version: snapshot.version,
        syncedAt,
        totalSyncedProjects: totalProjects,
        totalSyncedConversations: totalConversations,
        totalSyncedFiles: totalFiles,
        webViewLink: file.webViewLink || undefined,
      };
    } catch (err: any) {
      syncRepository.upsertSyncState(userId, {
        sync_status: 'error',
        error_message: err.message,
      });
      throw err;
    }
  }

  /**
   * Restores website data (projects, notes, conversations, outputs) from a Google Drive snapshot.
   */
  async restoreWebsiteDataSnapshot(
    userId: string,
    snapshotDriveFileId: string
  ): Promise<{
    restoredProjects: number;
    restoredNotes: number;
    restoredConversations: number;
    restoredMessages: number;
    restoredOutputs: number;
    restoredFilesMetadata: number;
  }> {
    const drive = await googleDriveService.getDriveClient(userId);

    const res = await drive.files.get(
      {
        fileId: snapshotDriveFileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'text' }
    );

    let snapshotData: WebsiteSyncSnapshot;
    try {
      snapshotData = typeof res.data === 'string' ? JSON.parse(res.data) : (res.data as WebsiteSyncSnapshot);
    } catch {
      throw new Error('Failed to parse snapshot file from Google Drive as JSON.');
    }

    if (!snapshotData || !snapshotData.studioName) {
      throw new Error('The selected Google Drive file is not a valid Archora sync manifest.');
    }

    const db = getDb();
    let restoredProjects = 0;
    let restoredNotes = 0;
    let restoredConversations = 0;
    let restoredMessages = 0;
    let restoredOutputs = 0;
    let restoredFilesMetadata = 0;

    const restoreTransaction = db.transaction(() => {
      // 1. Projects
      if (Array.isArray(snapshotData.projects)) {
        for (const p of snapshotData.projects) {
          const existing = projectRepository.findById(p.id, userId);
          if (!existing) {
            projectRepository.create({
              id: p.id,
              user_id: userId,
              title: p.title || 'Restored Project',
              category: p.category,
              semester: p.semester,
              subject: p.subject,
              year: p.year,
              site_location: p.site_location,
              site_dimensions: p.site_dimensions,
              site_area: p.site_area,
              typology: p.typology,
              description: p.description,
              architectural_style: p.architectural_style,
              start_date: p.start_date,
              expected_completion_date: p.expected_completion_date,
              design_requirements: p.design_requirements,
              status: p.status,
            });
            restoredProjects++;
          }
        }
      }

      // 2. Project Notes
      if (Array.isArray(snapshotData.projectNotes)) {
        for (const n of snapshotData.projectNotes) {
          const exists = db.prepare('SELECT id FROM project_notes WHERE id = ?').get(n.id);
          if (!exists) {
            db.prepare(`
              INSERT INTO project_notes (id, project_id, user_id, content, author, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(n.id, n.project_id, userId, n.content, n.author || 'User', n.created_at, n.updated_at);
            restoredNotes++;
          }
        }
      }

      // 3. Conversations
      if (Array.isArray(snapshotData.conversations)) {
        for (const c of snapshotData.conversations) {
          const exists = conversationRepository.findConversationById(c.id, userId);
          if (!exists) {
            conversationRepository.createConversation({
              id: c.id,
              user_id: userId,
              module: c.module || 'tutor',
              title: c.title || 'Restored Discussion',
              topic: c.topic,
              project_id: c.project_id,
            });
            restoredConversations++;
          }
        }
      }

      // 4. Messages
      if (Array.isArray(snapshotData.messages)) {
        for (const m of snapshotData.messages) {
          const exists = db.prepare('SELECT id FROM messages WHERE id = ?').get(m.id);
          if (!exists) {
            db.prepare(`
              INSERT INTO messages (
                id, conversation_id, user_id, role, content,
                citations_json, follow_up_suggestions_json, token_count, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              m.id,
              m.conversation_id,
              userId,
              m.role,
              m.content,
              m.citations_json || '[]',
              m.follow_up_suggestions_json || '[]',
              m.token_count || 0,
              m.created_at
            );
            restoredMessages++;
          }
        }
      }

      // 5. Saved Outputs
      if (Array.isArray(snapshotData.savedOutputs)) {
        for (const o of snapshotData.savedOutputs) {
          const exists = savedOutputRepository.findById(o.id, userId);
          if (!exists) {
            savedOutputRepository.create({
              id: o.id,
              user_id: userId,
              project_id: o.project_id,
              type: o.type,
              title: o.title,
              content: o.content,
            });
            restoredOutputs++;
          }
        }
      }

      // 6. Project Files Metadata
      if (Array.isArray(snapshotData.filesMetadata)) {
        for (const f of snapshotData.filesMetadata) {
          const exists = fileRepository.findById(f.id, userId);
          if (!exists) {
            fileRepository.create({
              id: f.id,
              user_id: userId,
              project_id: f.project_id,
              original_filename: f.original_filename,
              storage_filename: f.storage_filename || f.original_filename,
              storage_path: f.storage_path || `gdrive://${f.google_drive_file_id || 'unknown'}`,
              mime_type: f.mime_type || 'application/octet-stream',
              file_extension: f.file_extension || '',
              file_size: f.file_size || 0,
              description: f.description,
              category: f.category,
              google_drive_file_id: f.google_drive_file_id,
              cloud_storage_status: f.google_drive_file_id ? 'cloud_only' : 'local',
              cloud_web_view_link: f.cloud_web_view_link,
              cloud_thumbnail_link: f.cloud_thumbnail_link,
              cloud_md5_checksum: f.cloud_md5_checksum,
            });
            restoredFilesMetadata++;
          }
        }
      }
    });

    restoreTransaction();

    return {
      restoredProjects,
      restoredNotes,
      restoredConversations,
      restoredMessages,
      restoredOutputs,
      restoredFilesMetadata,
    };
  }

  /**
   * Replays pending offline actions (upload or delete) from the offline queue.
   */
  async processOfflineSyncQueue(userId: string): Promise<{
    processed: number;
    failed: number;
    remaining: number;
  }> {
    const queue = syncRepository.getPendingQueue(userId);
    let processed = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        const payload = JSON.parse(item.payload_json);

        if (item.action_type === 'file_upload') {
          if (fs.existsSync(payload.localPath)) {
            const driveRes = await this.uploadProjectFile(
              userId,
              payload.localPath,
              payload.originalFilename,
              payload.mimeType,
              { removeLocalAfterUpload: true }
            );

            if (driveRes.uploadedToCloud && driveRes.cloudFileId) {
              fileRepository.updateCloudStatus(item.entityId, userId, {
                google_drive_file_id: driveRes.cloudFileId,
                cloud_storage_status: 'cloud_only',
                cloud_web_view_link: driveRes.webViewLink,
                cloud_thumbnail_link: driveRes.thumbnailLink,
              });
              syncRepository.markQueueItemCompleted(item.id);
              processed++;
            } else {
              throw new Error(driveRes.error || 'Upload could not complete.');
            }
          } else {
            // Local file was already deleted or moved
            syncRepository.markQueueItemCompleted(item.id);
            processed++;
          }
        } else if (item.action_type === 'file_delete') {
          const drive = await googleDriveService.getDriveClient(userId);
          await drive.files.delete({
            fileId: payload.googleDriveFileId,
            supportsAllDrives: true,
          });
          syncRepository.markQueueItemCompleted(item.id);
          processed++;
        } else if (item.action_type === 'data_sync') {
          await this.uploadWebsiteDataSnapshot(userId);
          syncRepository.markQueueItemCompleted(item.id);
          processed++;
        }
      } catch (err: any) {
        syncRepository.markQueueItemFailed(item.id, err.message);
        failed++;
      }
    }

    const remaining = syncRepository.getPendingQueue(userId).length;
    return { processed, failed, remaining };
  }

  /**
   * Computes comprehensive storage metrics: local DB size, Google Drive storage, local space saved,
   * and host drive remaining capacity (<10 GB check).
   */
  getStorageOverview(userId: string): StorageOverview {
    // 1. Local Database file size
    const dbPath = getDatabasePath();
    let localDbBytes = 0;
    try {
      if (fs.existsSync(dbPath)) {
        localDbBytes = fs.statSync(dbPath).size;
      }
    } catch {
      localDbBytes = 0;
    }

    // 2. Storage usage metrics from SQLite
    const summary = fileRepository.getStorageUsageSummary(userId);

    // 3. Free local disk space (measures Drive D: where Archora is located)
    let freeDiskBytes = 0;
    try {
      const targetDir = path.dirname(dbPath);
      const stat = fs.statfsSync(targetDir);
      freeDiskBytes = Math.max(0, Number(stat.bavail) * Number(stat.bsize));
    } catch {
      // Fallback: check cwd
      try {
        const stat = fs.statfsSync(process.cwd());
        freeDiskBytes = Math.max(0, Number(stat.bavail) * Number(stat.bsize));
      } catch {
        freeDiskBytes = 140 * 1024 * 1024 * 1024; // Default assumption for D:
      }
    }

    // Safety fallback: if targetDir reported 0 (e.g. remnant on C:), resolve from cwd (Drive D:)
    if (freeDiskBytes <= 0) {
      try {
        const stat = fs.statfsSync(process.cwd());
        freeDiskBytes = Math.max(0, Number(stat.bavail) * Number(stat.bsize));
      } catch {
        // ignore
      }
    }

    const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;
    const isLowDiskSpace = freeDiskBytes < TEN_GB_BYTES;

    // 4. Drive folder and connection settings
    const settings = settingsRepository.get(userId);
    const targetFolderId = settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;
    const folderVerified = settings.google_drive_folder_status === 'verified';
    const googleConnected = Boolean(settings.google_drive_last_verified);

    return {
      localDatabaseBytes: localDbBytes,
      localDatabaseFormatted: formatBytes(localDbBytes),
      cloudFilesCount: summary.cloudFilesCount,
      cloudFilesSizeBytes: summary.cloudSizeBytes,
      cloudFilesSizeFormatted: formatBytes(summary.cloudSizeBytes),
      localFilesCount: summary.localOnlyCount,
      localFilesSizeBytes: summary.localOnlySizeBytes,
      localFilesSizeFormatted: formatBytes(summary.localOnlySizeBytes),
      savedLocalDiskBytes: summary.savedLocalBytes,
      savedLocalDiskFormatted: formatBytes(summary.savedLocalBytes),
      freeDiskBytes,
      freeDiskFormatted: formatBytes(freeDiskBytes),
      isLowDiskSpace,
      targetFolderId,
      folderVerified,
      googleConnected,
    };
  }
}

export const googleDriveStorageService = new GoogleDriveStorageService();

