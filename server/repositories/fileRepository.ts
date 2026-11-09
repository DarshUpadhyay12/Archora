import { getDb } from '../db/connection';
import { ProjectFileRecord } from '../types/db';

export interface FileFilterOptions {
  projectId?: string | null;
  category?: string;
  fileTypeGroup?: 'image' | 'pdf' | 'document' | 'drawing' | 'other';
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'filename' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export class FileRepository {
  /**
   * Persists new file metadata into SQLite with foreign key validation.
   */
  create(data: {
    id: string;
    user_id: string;
    project_id?: string | null;
    original_filename: string;
    storage_filename: string;
    storage_path: string;
    mime_type: string;
    file_extension: string;
    file_size: number;
    description?: string;
    category?: string;
    google_drive_file_id?: string | null;
    cloud_storage_status?: 'local' | 'synced' | 'cloud_only' | 'pending_upload' | 'pending_delete';
    cloud_web_view_link?: string | null;
    cloud_thumbnail_link?: string | null;
    cloud_md5_checksum?: string | null;
  }): ProjectFileRecord {
    const db = getDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO project_files (
        id, user_id, project_id, original_filename, storage_filename, 
        storage_path, mime_type, file_extension, file_size, description, 
        category, google_drive_file_id, cloud_storage_status, cloud_web_view_link,
        cloud_thumbnail_link, cloud_md5_checksum, created_at, updated_at
      ) VALUES (
        @id, @user_id, @project_id, @original_filename, @storage_filename,
        @storage_path, @mime_type, @file_extension, @file_size, @description,
        @category, @google_drive_file_id, @cloud_storage_status, @cloud_web_view_link,
        @cloud_thumbnail_link, @cloud_md5_checksum, @created_at, @updated_at
      )
    `);

    stmt.run({
      id: data.id,
      user_id: data.user_id,
      project_id: data.project_id || null,
      original_filename: data.original_filename,
      storage_filename: data.storage_filename,
      storage_path: data.storage_path,
      mime_type: data.mime_type,
      file_extension: data.file_extension,
      file_size: data.file_size,
      description: data.description || '',
      category: data.category || 'Other',
      google_drive_file_id: data.google_drive_file_id || null,
      cloud_storage_status: data.cloud_storage_status || 'local',
      cloud_web_view_link: data.cloud_web_view_link || null,
      cloud_thumbnail_link: data.cloud_thumbnail_link || null,
      cloud_md5_checksum: data.cloud_md5_checksum || null,
      created_at: now,
      updated_at: now,
    });

    return this.findById(data.id, data.user_id)!;
  }

  /**
   * Retrieves single file by ID and owner, joining project title if associated.
   */
  findById(id: string, userId: string): ProjectFileRecord | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT 
        pf.*,
        p.title AS project_title
      FROM project_files pf
      LEFT JOIN projects p ON pf.project_id = p.id
      WHERE pf.id = ? AND pf.user_id = ?
    `);

    const row = stmt.get(id, userId) as ProjectFileRecord | undefined;
    return row || null;
  }

  /**
   * Finds all files owned by user without filters (alias for full exports and sync).
   */
  findAllByUser(userId: string): ProjectFileRecord[] {
    return this.findByUser(userId, {});
  }

  /**
   * Finds all files owned by user with multi-criteria filtering, search, and sorting.
   */
  findByUser(userId: string, filters: FileFilterOptions = {}): ProjectFileRecord[] {
    const db = getDb();
    const conditions: string[] = ['pf.user_id = ?'];
    const params: any[] = [userId];

    if (filters.projectId !== undefined) {
      if (filters.projectId === null || filters.projectId === 'unassigned') {
        conditions.push('pf.project_id IS NULL');
      } else if (filters.projectId.trim() !== '') {
        conditions.push('pf.project_id = ?');
        params.push(filters.projectId);
      }
    }

    if (filters.category && filters.category !== 'All') {
      conditions.push('pf.category = ?');
      params.push(filters.category);
    }

    if (filters.fileTypeGroup && filters.fileTypeGroup !== 'other') {
      if (filters.fileTypeGroup === 'image') {
        conditions.push("pf.file_extension IN ('.jpg', '.jpeg', '.png', '.webp')");
      } else if (filters.fileTypeGroup === 'pdf') {
        conditions.push("pf.file_extension = '.pdf'");
      } else if (filters.fileTypeGroup === 'document') {
        conditions.push("pf.file_extension IN ('.docx', '.doc')");
      } else if (filters.fileTypeGroup === 'drawing') {
        conditions.push("pf.file_extension IN ('.dwg', '.dxf')");
      }
    }

    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      conditions.push('(pf.original_filename LIKE ? OR pf.description LIKE ?)');
      params.push(searchTerm, searchTerm);
    }

    let orderBy = 'pf.created_at DESC';
    if (filters.sortBy === 'oldest') {
      orderBy = 'pf.created_at ASC';
    } else if (filters.sortBy === 'filename') {
      orderBy = 'pf.original_filename COLLATE NOCASE ASC';
    } else if (filters.sortBy === 'size') {
      orderBy = 'pf.file_size DESC';
    }

    const query = `
      SELECT 
        pf.*,
        p.title AS project_title
      FROM project_files pf
      LEFT JOIN projects p ON pf.project_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
    `;

    return db.prepare(query).all(...params) as ProjectFileRecord[];
  }

  /**
   * Updates file display name, description, category, or project association.
   */
  update(
    id: string,
    userId: string,
    updates: {
      original_filename?: string;
      description?: string;
      category?: string;
      project_id?: string | null;
    }
  ): ProjectFileRecord | null {
    const db = getDb();
    const existing = this.findById(id, userId);
    if (!existing) return null;

    const sets: string[] = ['updated_at = ?'];
    const params: any[] = [new Date().toISOString()];

    if (updates.original_filename !== undefined) {
      sets.push('original_filename = ?');
      params.push(updates.original_filename);
    }
    if (updates.description !== undefined) {
      sets.push('description = ?');
      params.push(updates.description);
    }
    if (updates.category !== undefined) {
      sets.push('category = ?');
      params.push(updates.category);
    }
    if (updates.project_id !== undefined) {
      sets.push('project_id = ?');
      params.push(updates.project_id || null);
    }

    params.push(id, userId);

    const query = `
      UPDATE project_files
      SET ${sets.join(', ')}
      WHERE id = ? AND user_id = ?
    `;

    db.prepare(query).run(...params);
    return this.findById(id, userId);
  }

  /**
   * Deletes SQLite record for a file.
   */
  delete(id: string, userId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM project_files WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  }

  /**
   * Counts files owned by user, optionally scoped to a project.
   */
  countByUser(userId: string, projectId?: string): number {
    const db = getDb();
    if (projectId) {
      const row = db
        .prepare('SELECT count(*) as count FROM project_files WHERE user_id = ? AND project_id = ?')
        .get(userId, projectId) as { count: number };
      return row.count;
    }
    const row = db
      .prepare('SELECT count(*) as count FROM project_files WHERE user_id = ?')
      .get(userId) as { count: number };
    return row.count;
  }

  /**
   * Computes storage usage summary for user: cloud files vs local files and saved disk bytes.
   */
  getStorageUsageSummary(userId: string): {
    cloudFilesCount: number;
    cloudSizeBytes: number;
    localOnlyCount: number;
    localOnlySizeBytes: number;
    savedLocalBytes: number;
  } {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        COUNT(CASE WHEN google_drive_file_id IS NOT NULL AND google_drive_file_id != '' THEN 1 END) as cloudFilesCount,
        COALESCE(SUM(CASE WHEN google_drive_file_id IS NOT NULL AND google_drive_file_id != '' THEN file_size ELSE 0 END), 0) as cloudSizeBytes,
        COUNT(CASE WHEN google_drive_file_id IS NULL OR google_drive_file_id = '' THEN 1 END) as localOnlyCount,
        COALESCE(SUM(CASE WHEN google_drive_file_id IS NULL OR google_drive_file_id = '' THEN file_size ELSE 0 END), 0) as localOnlySizeBytes
      FROM project_files
      WHERE user_id = ?
    `).get(userId) as any;

    const cloudFilesCount = Number(rows?.cloudFilesCount || 0);
    const cloudSizeBytes = Number(rows?.cloudSizeBytes || 0);
    const localOnlyCount = Number(rows?.localOnlyCount || 0);
    const localOnlySizeBytes = Number(rows?.localOnlySizeBytes || 0);
    const savedLocalBytes = cloudSizeBytes;

    return {
      cloudFilesCount,
      cloudSizeBytes,
      localOnlyCount,
      localOnlySizeBytes,
      savedLocalBytes,
    };
  }
}

export const fileRepository = new FileRepository();

