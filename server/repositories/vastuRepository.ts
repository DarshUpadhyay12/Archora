import { getDb } from '../db/connection';
import { VASTU_RULES_CATALOG } from '../services/vastuKnowledgeBase';

export interface VastuAnalysisRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  building_type: string;
  geographic_north_degrees: number;
  floor_plan_file_id: string | null;
  floor_plan_image_url: string | null;
  orientation_confirmed: number;
  rooms_json: string;
  results_json: string;
  summary: string | null;
  tradition: string;
  created_at: string;
  updated_at: string;
}

export const vastuRepository = {
  /**
   * Seed knowledge rules catalog into SQLite if empty.
   */
  seedRulesIfEmpty(): void {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM vastu_knowledge_rules').get() as { count: number };
    if (countRow.count === 0) {
      const insert = db.prepare(`
        INSERT INTO vastu_knowledge_rules (
          id, rule_id, topic, direction, space_type, recommendation, explanation,
          source_reference, tradition, variations, confidence_level, architectural_rationale, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const now = new Date().toISOString();
      const insertMany = db.transaction((rules: typeof VASTU_RULES_CATALOG) => {
        for (const r of rules) {
          insert.run(
            r.id,
            r.rule_id,
            r.topic,
            r.direction,
            r.space_type,
            r.recommendation,
            r.explanation,
            r.source_reference,
            r.tradition,
            r.variations || '',
            r.confidence_level,
            r.architectural_rationale,
            now
          );
        }
      });
      insertMany(VASTU_RULES_CATALOG);
      console.log(`[VastuRepository] Seeded ${VASTU_RULES_CATALOG.length} authentic Vastu knowledge rules.`);
    }
  },

  /**
   * Create a new Vastu analysis.
   */
  create(data: {
    id: string;
    user_id: string;
    project_id?: string | null;
    title: string;
    building_type?: string;
    geographic_north_degrees?: number;
    floor_plan_file_id?: string | null;
    floor_plan_image_url?: string | null;
    orientation_confirmed?: boolean;
    rooms: any[];
    results: any;
    summary?: string;
    tradition?: string;
  }): VastuAnalysisRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO vastu_analyses (
        id, user_id, project_id, title, building_type, geographic_north_degrees,
        floor_plan_file_id, floor_plan_image_url, orientation_confirmed,
        rooms_json, results_json, summary, tradition, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.user_id,
      data.project_id || null,
      data.title,
      data.building_type || 'Residential',
      data.geographic_north_degrees || 0.0,
      data.floor_plan_file_id || null,
      data.floor_plan_image_url || null,
      data.orientation_confirmed !== false ? 1 : 0,
      JSON.stringify(data.rooms || []),
      JSON.stringify(data.results || {}),
      data.summary || null,
      data.tradition || 'Manasara',
      now,
      now
    );

    return this.findById(data.id, data.user_id)!;
  },

  /**
   * Find analysis by ID with user isolation.
   */
  findById(id: string, userId: string): VastuAnalysisRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM vastu_analyses WHERE id = ? AND user_id = ?
    `).get(id, userId) as VastuAnalysisRecord | undefined;
    return row || null;
  },

  /**
   * List all analyses for user, optionally filtered by project.
   */
  listByUser(userId: string, projectId?: string): VastuAnalysisRecord[] {
    const db = getDb();
    if (projectId) {
      return db.prepare(`
        SELECT * FROM vastu_analyses 
        WHERE user_id = ? AND project_id = ?
        ORDER BY created_at DESC
      `).all(userId, projectId) as VastuAnalysisRecord[];
    }
    return db.prepare(`
      SELECT * FROM vastu_analyses 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as VastuAnalysisRecord[];
  },

  /**
   * Update an existing analysis.
   */
  update(id: string, userId: string, updates: {
    title?: string;
    project_id?: string | null;
    building_type?: string;
    geographic_north_degrees?: number;
    floor_plan_image_url?: string | null;
    orientation_confirmed?: boolean;
    rooms?: any[];
    results?: any;
    summary?: string;
    tradition?: string;
  }): VastuAnalysisRecord | null {
    const db = getDb();
    const existing = this.findById(id, userId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE vastu_analyses SET
        title = COALESCE(?, title),
        project_id = COALESCE(?, project_id),
        building_type = COALESCE(?, building_type),
        geographic_north_degrees = COALESCE(?, geographic_north_degrees),
        floor_plan_image_url = COALESCE(?, floor_plan_image_url),
        orientation_confirmed = COALESCE(?, orientation_confirmed),
        rooms_json = COALESCE(?, rooms_json),
        results_json = COALESCE(?, results_json),
        summary = COALESCE(?, summary),
        tradition = COALESCE(?, tradition),
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(
      updates.title !== undefined ? updates.title : null,
      updates.project_id !== undefined ? updates.project_id : null,
      updates.building_type !== undefined ? updates.building_type : null,
      updates.geographic_north_degrees !== undefined ? updates.geographic_north_degrees : null,
      updates.floor_plan_image_url !== undefined ? updates.floor_plan_image_url : null,
      updates.orientation_confirmed !== undefined ? (updates.orientation_confirmed ? 1 : 0) : null,
      updates.rooms !== undefined ? JSON.stringify(updates.rooms) : null,
      updates.results !== undefined ? JSON.stringify(updates.results) : null,
      updates.summary !== undefined ? updates.summary : null,
      updates.tradition !== undefined ? updates.tradition : null,
      now,
      id,
      userId
    );

    return this.findById(id, userId);
  },

  /**
   * Delete an analysis.
   */
  delete(id: string, userId: string): boolean {
    const db = getDb();
    const res = db.prepare(`
      DELETE FROM vastu_analyses WHERE id = ? AND user_id = ?
    `).run(id, userId);
    return res.changes > 0;
  },

  /**
   * Search knowledge base rules.
   */
  getRules(filter?: { space_type?: string; direction?: string; tradition?: string }): any[] {
    const db = getDb();
    this.seedRulesIfEmpty();

    let query = 'SELECT * FROM vastu_knowledge_rules WHERE 1=1';
    const params: any[] = [];

    if (filter?.space_type) {
      query += ' AND space_type LIKE ?';
      params.push(`%${filter.space_type}%`);
    }
    if (filter?.direction) {
      query += ' AND direction = ?';
      params.push(filter.direction);
    }
    if (filter?.tradition) {
      query += ' AND tradition = ?';
      params.push(filter.tradition);
    }

    query += ' ORDER BY direction ASC, space_type ASC';
    return db.prepare(query).all(...params);
  }
};
