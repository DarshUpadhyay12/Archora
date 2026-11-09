import { getDb } from '../db/connection';
import { SavedOutputRecord } from '../types/db';

export interface SavedOutputFilterOptions {
  type?: string;
  projectId?: string;
  search?: string;
  sortBy?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export interface EnrichedSavedOutputRecord extends SavedOutputRecord {
  project_title?: string | null;
}

export const savedOutputRepository = {
  create(data: {
    id: string;
    user_id: string;
    project_id?: string | null;
    type: string;
    title: string;
    content: string;
    metadata?: Record<string, any>;
  }): SavedOutputRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const metadataJson = JSON.stringify(data.metadata || {});

    const stmt = db.prepare(`
      INSERT INTO saved_outputs (
        id, user_id, project_id, type, title, content, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.user_id,
      data.project_id || null,
      data.type,
      data.title,
      data.content,
      metadataJson,
      now,
      now
    );

    return {
      id: data.id,
      user_id: data.user_id,
      project_id: data.project_id || null,
      type: data.type,
      title: data.title,
      content: data.content,
      metadata_json: metadataJson,
      created_at: now,
      updated_at: now,
    };
  },

  findByUser(userId: string, options?: SavedOutputFilterOptions | string, legacyProjectId?: string): EnrichedSavedOutputRecord[] {
    const db = getDb();
    const conditions = ['s.user_id = ?'];
    const params: any[] = [userId];

    let type: string | undefined;
    let projectId: string | undefined;
    let search: string | undefined;
    let sortBy: 'newest' | 'oldest' = 'newest';
    let limit: number | undefined;
    let offset: number | undefined;

    if (typeof options === 'string') {
      type = options;
      projectId = legacyProjectId;
    } else if (legacyProjectId) {
      projectId = legacyProjectId;
      if (options) {
        type = options.type;
        search = options.search;
        sortBy = options.sortBy || 'newest';
        limit = options.limit;
        offset = options.offset;
      }
    } else if (options) {
      type = options.type;
      projectId = options.projectId;
      search = options.search;
      sortBy = options.sortBy || 'newest';
      limit = options.limit;
      offset = options.offset;
    }

    if (type) {
      conditions.push('s.type = ?');
      params.push(type);
    }
    if (projectId) {
      conditions.push('s.project_id = ?');
      params.push(projectId);
    }
    if (search) {
      conditions.push('(s.title LIKE ? OR s.content LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    const orderDirection = sortBy === 'oldest' ? 'ASC' : 'DESC';
    const limitClause = limit ? `LIMIT ${Number(limit)} OFFSET ${Number(offset || 0)}` : '';

    const sql = `
      SELECT s.*, p.title AS project_title
      FROM saved_outputs s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.created_at ${orderDirection}
      ${limitClause}
    `;

    return db.prepare(sql).all(...params) as EnrichedSavedOutputRecord[];
  },

  findById(id: string, userId: string): EnrichedSavedOutputRecord | null {
    const db = getDb();
    const sql = `
      SELECT s.*, p.title AS project_title
      FROM saved_outputs s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE s.id = ? AND s.user_id = ?
    `;
    const row = db.prepare(sql).get(id, userId) as EnrichedSavedOutputRecord | undefined;
    return row || null;
  },

  update(
    id: string,
    userId: string,
    updates: {
      title?: string;
      project_id?: string | null;
      content?: string;
      metadata?: Record<string, any>;
    }
  ): EnrichedSavedOutputRecord | null {
    const db = getDb();
    const existing = this.findById(id, userId);
    if (!existing) return null;

    const newTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
    const newProjectId = updates.project_id !== undefined ? updates.project_id : existing.project_id;
    const newContent = updates.content !== undefined ? updates.content : existing.content;
    const newMetadataJson = updates.metadata !== undefined ? JSON.stringify(updates.metadata) : existing.metadata_json;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE saved_outputs
      SET title = ?, project_id = ?, content = ?, metadata_json = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(newTitle, newProjectId || null, newContent, newMetadataJson, now, id, userId);

    return this.findById(id, userId);
  },

  delete(id: string, userId: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM saved_outputs WHERE id = ? AND user_id = ?`).run(id, userId);
    return result.changes > 0;
  }
};
