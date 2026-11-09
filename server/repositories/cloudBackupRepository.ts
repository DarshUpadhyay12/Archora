import { getDb } from '../db/connection';
import { CloudBackupRecord } from '../types/db';

export const cloudBackupRepository = {
  createRecord(data: {
    id: string;
    userId: string;
    localBackupId?: string | null;
    googleDriveFileId: string;
    googleDriveFolderId: string;
    filename: string;
    fileSizeBytes: number;
    checksumSha256?: string | null;
    fileCount: number;
    createdAt?: string;
    uploadedAt?: string;
  }): CloudBackupRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;
    const uploadedAt = data.uploadedAt || now;

    const stmt = db.prepare(`
      INSERT INTO cloud_backups (
        id, user_id, local_backup_id, google_drive_file_id, google_drive_folder_id,
        filename, file_size_bytes, checksum_sha256, file_count, created_at, uploaded_at
      ) VALUES (
        @id, @userId, @localBackupId, @googleDriveFileId, @googleDriveFolderId,
        @filename, @fileSizeBytes, @checksumSha256, @fileCount, @createdAt, @uploadedAt
      )
    `);

    stmt.run({
      id: data.id,
      userId: data.userId,
      localBackupId: data.localBackupId || null,
      googleDriveFileId: data.googleDriveFileId,
      googleDriveFolderId: data.googleDriveFolderId,
      filename: data.filename,
      fileSizeBytes: data.fileSizeBytes,
      checksumSha256: data.checksumSha256 || null,
      fileCount: data.fileCount,
      createdAt,
      uploadedAt,
    });

    return {
      id: data.id,
      user_id: data.userId,
      local_backup_id: data.localBackupId || null,
      google_drive_file_id: data.googleDriveFileId,
      google_drive_folder_id: data.googleDriveFolderId,
      filename: data.filename,
      file_size_bytes: data.fileSizeBytes,
      checksum_sha256: data.checksumSha256 || null,
      file_count: data.fileCount,
      created_at: createdAt,
      uploaded_at: uploadedAt,
    };
  },

  findByFileId(fileId: string): CloudBackupRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM cloud_backups WHERE google_drive_file_id = ?').get(fileId) as CloudBackupRecord | undefined;
    return row || null;
  },

  findByFilename(filename: string, userId?: string): CloudBackupRecord | null {
    const db = getDb();
    let query = 'SELECT * FROM cloud_backups WHERE filename = ?';
    const params: any[] = [filename];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as CloudBackupRecord | undefined;
    return row || null;
  },

  listByUser(userId: string, folderId?: string): CloudBackupRecord[] {
    const db = getDb();
    let query = 'SELECT * FROM cloud_backups WHERE user_id = ?';
    const params: any[] = [userId];

    if (folderId) {
      query += ' AND google_drive_folder_id = ?';
      params.push(folderId);
    }

    query += ' ORDER BY uploaded_at DESC';
    return db.prepare(query).all(...params) as CloudBackupRecord[];
  },

  deleteByFileId(fileId: string, userId?: string): boolean {
    const db = getDb();
    let query = 'DELETE FROM cloud_backups WHERE google_drive_file_id = ?';
    const params: any[] = [fileId];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const result = db.prepare(query).run(...params);
    return result.changes > 0;
  },
};
