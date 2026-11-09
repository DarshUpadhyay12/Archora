import { getDb } from '../db/connection';
import { SessionRecord, SafeUser } from '../types/db';

export const sessionRepository = {
  create(token: string, userId: string, expiresAt: string): SessionRecord {
    const db = getDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(token, userId, expiresAt, now);

    return {
      token,
      user_id: userId,
      expires_at: expiresAt,
      created_at: now,
    };
  },

  findByToken(token: string): { session: SessionRecord; user: SafeUser } | null {
    const db = getDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      SELECT 
        s.token, s.user_id, s.expires_at, s.created_at,
        u.id as u_id, u.email as u_email, u.full_name as u_full_name,
        u.role as u_role, u.university as u_university,
        u.semester as u_semester, u.bio as u_bio,
        u.created_at as u_created_at, u.updated_at as u_updated_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `);

    const row = stmt.get(token, now) as any;
    if (!row) return null;

    return {
      session: {
        token: row.token,
        user_id: row.user_id,
        expires_at: row.expires_at,
        created_at: row.created_at,
      },
      user: {
        id: row.u_id,
        email: row.u_email,
        full_name: row.u_full_name,
        role: row.u_role,
        university: row.u_university,
        semester: row.u_semester,
        bio: row.u_bio,
        created_at: row.u_created_at,
        updated_at: row.u_updated_at,
      },
    };
  },

  deleteByToken(token: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return result.changes > 0;
  },

  deleteByUserId(userId: string): number {
    const db = getDb();
    const result = db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
    return result.changes;
  },

  deleteExpired(): number {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(now);
    return result.changes;
  }
};

