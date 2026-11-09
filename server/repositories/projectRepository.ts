import { getDb } from '../db/connection';
import { ProjectRecord, ProjectNoteRecord } from '../types/db';

export interface ProjectQueryOptions {
  search?: string;
  category?: string;
  status?: string;
  semester?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'year';
  sortOrder?: 'ASC' | 'DESC';
}

export const projectRepository = {
  create(data: {
    id: string;
    user_id: string;
    title: string;
    category?: string;
    semester?: string;
    subject?: string;
    year?: number;
    site_location?: string;
    site_dimensions?: string;
    site_area?: string;
    typology?: string;
    description?: string;
    architectural_style?: string;
    start_date?: string;
    expected_completion_date?: string;
    design_requirements?: string;
    notes?: string[];
    status?: 'In Progress' | 'Completed' | 'Review Ready';
  }): ProjectRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const category = data.category || 'Studio';
    const semester = data.semester || '';
    const subject = data.subject || '';
    const year = data.year || new Date().getFullYear();
    const site_location = data.site_location || '';
    const site_dimensions = data.site_dimensions || '';
    const site_area = data.site_area || '';
    const typology = data.typology || '';
    const description = data.description || '';
    const architectural_style = data.architectural_style || '';
    const start_date = data.start_date || '';
    const expected_completion_date = data.expected_completion_date || '';
    const design_requirements = data.design_requirements || '';
    const notesJson = JSON.stringify(data.notes || []);
    const status = data.status || 'In Progress';

    const stmt = db.prepare(`
      INSERT INTO projects (
        id, user_id, title, category, semester, subject, year,
        site_location, site_dimensions, site_area, typology, description,
        architectural_style, start_date, expected_completion_date, design_requirements,
        notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.user_id,
      data.title.trim(),
      category,
      semester,
      subject,
      year,
      site_location,
      site_dimensions,
      site_area,
      typology,
      description,
      architectural_style,
      start_date,
      expected_completion_date,
      design_requirements,
      notesJson,
      status,
      now,
      now
    );

    return {
      id: data.id,
      user_id: data.user_id,
      title: data.title.trim(),
      category,
      semester,
      subject,
      year,
      site_location,
      site_dimensions,
      site_area,
      typology,
      description,
      architectural_style,
      start_date,
      expected_completion_date,
      design_requirements,
      notes: notesJson,
      status,
      created_at: now,
      updated_at: now,
    };
  },

  findById(id: string, userId: string): ProjectRecord | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM projects WHERE id = ? AND user_id = ?
    `);
    const row = stmt.get(id, userId) as ProjectRecord | undefined;
    return row || null;
  },

  findByUser(userId: string, options: ProjectQueryOptions = {}): ProjectRecord[] {
    return this.findAll(userId, options);
  },

  findAll(userId: string, options: ProjectQueryOptions = {}): ProjectRecord[] {
    const db = getDb();
    const conditions: string[] = ['user_id = ?'];
    const params: any[] = [userId];

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      conditions.push('(title LIKE ? OR description LIKE ? OR typology LIKE ? OR site_location LIKE ? OR subject LIKE ? OR architectural_style LIKE ?)');
      params.push(term, term, term, term, term, term);
    }

    if (options.category && options.category !== 'All') {
      conditions.push('category = ?');
      params.push(options.category);
    }

    if (options.status && options.status !== 'All') {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options.semester && options.semester !== 'All') {
      conditions.push('semester = ?');
      params.push(options.semester);
    }

    // Allowed sort columns preventing SQL injection
    const allowedSort = ['created_at', 'updated_at', 'title', 'year'];
    const sortBy = options.sortBy && allowedSort.includes(options.sortBy) ? options.sortBy : 'updated_at';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT * FROM projects
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortBy} ${sortOrder}
    `;

    return db.prepare(sql).all(...params) as ProjectRecord[];
  },

  update(id: string, userId: string, updates: Partial<{
    title: string;
    category: string;
    semester: string;
    subject: string;
    year: number;
    site_location: string;
    site_dimensions: string;
    site_area: string;
    typology: string;
    description: string;
    architectural_style: string;
    start_date: string;
    expected_completion_date: string;
    design_requirements: string;
    notes: string[];
    status: 'In Progress' | 'Completed' | 'Review Ready';
  }>): ProjectRecord | null {
    const current = this.findById(id, userId);
    if (!current) return null;

    const db = getDb();
    const title = updates.title !== undefined ? updates.title.trim() : current.title;
    const category = updates.category !== undefined ? updates.category : current.category;
    const semester = updates.semester !== undefined ? updates.semester : current.semester;
    const subject = updates.subject !== undefined ? updates.subject : current.subject;
    const year = updates.year !== undefined ? updates.year : current.year;
    const site_location = updates.site_location !== undefined ? updates.site_location : current.site_location;
    const site_dimensions = updates.site_dimensions !== undefined ? updates.site_dimensions : current.site_dimensions;
    const site_area = updates.site_area !== undefined ? updates.site_area : current.site_area;
    const typology = updates.typology !== undefined ? updates.typology : current.typology;
    const description = updates.description !== undefined ? updates.description : current.description;
    const architectural_style = updates.architectural_style !== undefined ? updates.architectural_style : current.architectural_style;
    const start_date = updates.start_date !== undefined ? updates.start_date : current.start_date;
    const expected_completion_date = updates.expected_completion_date !== undefined ? updates.expected_completion_date : current.expected_completion_date;
    const design_requirements = updates.design_requirements !== undefined ? updates.design_requirements : current.design_requirements;
    const notesJson = updates.notes !== undefined ? JSON.stringify(updates.notes) : current.notes;
    const status = updates.status !== undefined ? updates.status : current.status;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE projects SET
        title = ?, category = ?, semester = ?, subject = ?, year = ?,
        site_location = ?, site_dimensions = ?, site_area = ?, typology = ?, description = ?,
        architectural_style = ?, start_date = ?, expected_completion_date = ?, design_requirements = ?,
        notes = ?, status = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(
      title, category, semester, subject, year,
      site_location, site_dimensions, site_area, typology, description,
      architectural_style, start_date, expected_completion_date, design_requirements,
      notesJson, status, now,
      id, userId
    );

    return this.findById(id, userId);
  },

  delete(id: string, userId: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM projects WHERE id = ? AND user_id = ?`).run(id, userId);
    return result.changes > 0;
  },

  // Project Notes in SQLite
  addNote(data: {
    id: string;
    project_id: string;
    user_id: string;
    content: string;
    author?: string;
  }): ProjectNoteRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const author = data.author || 'Architect';

    const stmt = db.prepare(`
      INSERT INTO project_notes (id, project_id, user_id, content, author, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(data.id, data.project_id, data.user_id, data.content.trim(), author, now, now);

    return {
      id: data.id,
      project_id: data.project_id,
      user_id: data.user_id,
      content: data.content.trim(),
      author,
      created_at: now,
      updated_at: now,
    };
  },

  getNotes(projectId: string, userId: string): ProjectNoteRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM project_notes
      WHERE project_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `).all(projectId, userId) as ProjectNoteRecord[];
  },

  listNotes(projectId: string, userId: string): ProjectNoteRecord[] {
    return this.getNotes(projectId, userId);
  },

  updateNote(noteId: string, projectId: string, userId: string, content: string): ProjectNoteRecord | null {
    const db = getDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE project_notes
      SET content = ?, updated_at = ?
      WHERE id = ? AND project_id = ? AND user_id = ?
    `);

    const res = stmt.run(content.trim(), now, noteId, projectId, userId);
    if (res.changes === 0) return null;

    return db.prepare(`SELECT * FROM project_notes WHERE id = ?`).get(noteId) as ProjectNoteRecord;
  },

  deleteNote(noteId: string, projectId: string, userId: string): boolean {
    const db = getDb();
    const res = db.prepare(`
      DELETE FROM project_notes WHERE id = ? AND project_id = ? AND user_id = ?
    `).run(noteId, projectId, userId);
    return res.changes > 0;
  }
};
