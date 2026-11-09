import { getDb } from '../db/connection';
import { UserRecord, SafeUser } from '../types/db';

export const userRepository = {
  create(data: {
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    role?: string;
    university?: string;
    semester?: string;
    bio?: string;
  }): SafeUser {
    const db = getDb();
    const now = new Date().toISOString();
    const role = data.role || 'Architecture Student';
    const university = data.university || '';
    const semester = data.semester || '';
    const bio = data.bio || '';

    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, university, semester, bio, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.email.trim().toLowerCase(),
      data.password_hash,
      data.full_name.trim(),
      role,
      university,
      semester,
      bio,
      now,
      now
    );

    return {
      id: data.id,
      email: data.email.trim().toLowerCase(),
      full_name: data.full_name.trim(),
      role,
      university,
      semester,
      bio,
      created_at: now,
      updated_at: now,
    };
  },

  findByEmail(email: string): UserRecord | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM users WHERE email = ? COLLATE NOCASE
    `);
    const row = stmt.get(email.trim().toLowerCase()) as UserRecord | undefined;
    return row || null;
  },

  findById(id: string): UserRecord | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);
    const row = stmt.get(id) as UserRecord | undefined;
    return row || null;
  },

  findSafeById(id: string): SafeUser | null {
    const user = this.findById(id);
    if (!user) return null;
    const { password_hash, ...safe } = user;
    return safe;
  },

  update(id: string, updates: Partial<{
    full_name: string;
    role: string;
    university: string;
    semester: string;
    bio: string;
  }>): SafeUser | null {
    const db = getDb();
    const current = this.findById(id);
    if (!current) return null;

    const full_name = updates.full_name !== undefined ? updates.full_name.trim() : current.full_name;
    const role = updates.role !== undefined ? updates.role : current.role;
    const university = updates.university !== undefined ? updates.university : current.university;
    const semester = updates.semester !== undefined ? updates.semester : current.semester;
    const bio = updates.bio !== undefined ? updates.bio : current.bio;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE users
      SET full_name = ?, role = ?, university = ?, semester = ?, bio = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(full_name, role, university, semester, bio, now, id);
    return this.findSafeById(id);
  },

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    return result.changes > 0;
  }
};

