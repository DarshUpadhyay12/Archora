import { getDb } from '../db/connection';
import { BackupRecord } from '../types/db';

export const backupRepository = {
  createRecord(data: {
    id: string;
    user_id?: string | null;
    filename: string;
    file_path: string;
    file_size_bytes: number;
    backup_version?: string;
    schema_version?: number;
    is_automatic?: boolean | number;
    checksum_sha256?: string | null;
    file_count: number;
    created_at?: string;
  }): BackupRecord {
    const db = getDb();
    const now = data.created_at || new Date().toISOString();
    const isAuto = data.is_automatic ? 1 : 0;
    const backupVer = data.backup_version || '1.0.0';
    const schemaVer = data.schema_version || 7;

    const stmt = db.prepare(`
      INSERT INTO backup_records (
        id, user_id, filename, file_path, file_size_bytes,
        backup_version, schema_version, is_automatic, checksum_sha256,
        file_count, created_at
      ) VALUES (
        @id, @user_id, @filename, @file_path, @file_size_bytes,
        @backup_version, @schema_version, @is_automatic, @checksum_sha256,
        @file_count, @created_at
      )
    `);

    stmt.run({
      id: data.id,
      user_id: data.user_id || null,
      filename: data.filename,
      file_path: data.file_path,
      file_size_bytes: data.file_size_bytes,
      backup_version: backupVer,
      schema_version: schemaVer,
      is_automatic: isAuto,
      checksum_sha256: data.checksum_sha256 || null,
      file_count: data.file_count,
      created_at: now,
    });

    return {
      id: data.id,
      user_id: data.user_id || null,
      filename: data.filename,
      file_path: data.file_path,
      file_size_bytes: data.file_size_bytes,
      backup_version: backupVer,
      schema_version: schemaVer,
      is_automatic: isAuto,
      checksum_sha256: data.checksum_sha256 || null,
      file_count: data.file_count,
      created_at: now,
    };
  },

  findById(id: string, userId?: string): BackupRecord | null {
    const db = getDb();
    const condition = userId ? 'WHERE id = ? AND (user_id = ? OR user_id IS NULL)' : 'WHERE id = ?';
    const params = userId ? [id, userId] : [id];
    const row = db.prepare(`SELECT * FROM backup_records ${condition}`).get(...params) as BackupRecord | undefined;
    return row || null;
  },

  findByFilename(filename: string, userId?: string): BackupRecord | null {
    const db = getDb();
    const condition = userId ? 'WHERE filename = ? AND (user_id = ? OR user_id IS NULL)' : 'WHERE filename = ?';
    const params = userId ? [filename, userId] : [filename];
    const row = db.prepare(`SELECT * FROM backup_records ${condition}`).get(...params) as BackupRecord | undefined;
    return row || null;
  },

  listAll(userId?: string): BackupRecord[] {
    const db = getDb();
    const condition = userId ? 'WHERE user_id = ? OR user_id IS NULL' : '';
    const params = userId ? [userId] : [];
    return db.prepare(`SELECT * FROM backup_records ${condition} ORDER BY created_at DESC`).all(...params) as BackupRecord[];
  },

  deleteRecord(filename: string, userId?: string): boolean {
    const db = getDb();
    const condition = userId ? 'WHERE filename = ? AND (user_id = ? OR user_id IS NULL)' : 'WHERE filename = ?';
    const params = userId ? [filename, userId] : [filename];
    const res = db.prepare(`DELETE FROM backup_records ${condition}`).run(...params);
    return res.changes > 0;
  },

  getAutomaticBackups(userId?: string): BackupRecord[] {
    const db = getDb();
    const condition = userId ? 'WHERE is_automatic = 1 AND (user_id = ? OR user_id IS NULL)' : 'WHERE is_automatic = 1';
    const params = userId ? [userId] : [];
    return db.prepare(`SELECT * FROM backup_records ${condition} ORDER BY created_at DESC`).all(...params) as BackupRecord[];
  }
};

