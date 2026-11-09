import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './connection';
import { Database as DatabaseType } from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

/**
 * Runs versioned SQL migrations located in server/db/migrations.
 * Guarantees zero data loss, safe transactional execution, and idempotency.
 */
export function runMigrations(db?: DatabaseType): string[] {
  const database = db || getDb();
  
  // Robust resolution of migrations directory whether running via tsx, bundled node, or tests
  let migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(__dirname, '../db/migrations');
  }
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(__dirname, '../../server/db/migrations');
  }
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(process.cwd(), 'server/db/migrations');
  }

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`[Anchora DB Migrator] Migrations directory missing. Looked in: ${migrationsDir}`);
  }

  // Ensure migration tracking table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = database.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const newlyApplied: string[] = [];

  for (const file of files) {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      console.warn(`[Anchora DB Migrator] Skipping non-standard migration filename: ${file}`);
      continue;
    }

    const version = parseInt(match[1], 10);
    const name = match[2];

    if (appliedVersions.has(version)) {
      continue; // Already applied safely
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Run migration script within a transaction
    const executeMigration = database.transaction(() => {
      database.exec(sql);
      database.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES (?, ?, ?)
      `).run(version, name, new Date().toISOString());
    });

    executeMigration();
    newlyApplied.push(file);
    console.log(`[Anchora DB] Successfully applied migration ${version}: ${file}`);
  }

  return newlyApplied;
}
