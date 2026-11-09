import { getDb } from '../db/connection';
import { PdfExportRecord, ExportDocumentType, ExportCustomOptions } from '../types/db';

export class ExportRepository {
  /**
   * Persists PDF export record into SQLite.
   */
  create(data: {
    id: string;
    user_id: string;
    project_id?: string | null;
    export_type: ExportDocumentType;
    document_title: string;
    options?: ExportCustomOptions;
    file_path?: string | null;
    page_count?: number;
  }): PdfExportRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const optionsJson = JSON.stringify(data.options || {});

    const stmt = db.prepare(`
      INSERT INTO pdf_exports (
        id, user_id, project_id, export_type, document_title,
        options_json, file_path, page_count, created_at
      ) VALUES (
        @id, @user_id, @project_id, @export_type, @document_title,
        @options_json, @file_path, @page_count, @created_at
      )
    `);

    stmt.run({
      id: data.id,
      user_id: data.user_id,
      project_id: data.project_id || null,
      export_type: data.export_type,
      document_title: data.document_title,
      options_json: optionsJson,
      file_path: data.file_path || null,
      page_count: data.page_count || 1,
      created_at: now,
    });

    return this.findById(data.id, data.user_id)!;
  }

  /**
   * Finds export record by ID and user with project join.
   */
  findById(id: string, userId: string): PdfExportRecord | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT 
        pe.*,
        p.title AS project_title
      FROM pdf_exports pe
      LEFT JOIN projects p ON pe.project_id = p.id
      WHERE pe.id = ? AND pe.user_id = ?
    `);

    const row = stmt.get(id, userId) as PdfExportRecord | undefined;
    return row || null;
  }

  /**
   * Lists past exports for user.
   */
  findByUser(userId: string, limit: number = 20): PdfExportRecord[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT 
        pe.*,
        p.title AS project_title
      FROM pdf_exports pe
      LEFT JOIN projects p ON pe.project_id = p.id
      WHERE pe.user_id = ?
      ORDER BY pe.created_at DESC
      LIMIT ?
    `);

    return stmt.all(userId, limit) as PdfExportRecord[];
  }

  /**
   * Deletes an export record.
   */
  delete(id: string, userId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM pdf_exports WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  }
}

export const exportRepository = new ExportRepository();

