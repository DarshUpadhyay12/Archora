import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: DatabaseType | null = null;
let activeDbPath: string = '';

/**
 * Resolves the persistent SQLite database path.
 * Defaults to: %LOCALAPPDATA%\Anchora\data\anchora.db on Windows.
 * Overridable via process.env.DATABASE_PATH (useful for testing and environments).
 */
export function resolveDatabasePath(overridePath?: string): string {
  if (overridePath === ':memory:') {
    return ':memory:';
  }
  if (overridePath) {
    return path.resolve(overridePath);
  }
  if (process.env.DATABASE_PATH === ':memory:') {
    return ':memory:';
  }
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }

  // 1. Dedicated Drive D: project storage directory (strictly avoids full Drive C:)
  const projectDataArchora = path.resolve(process.cwd(), 'data', 'archora.db');
  const projectDataAnchora = path.resolve(process.cwd(), 'data', 'anchora.db');
  if (fs.existsSync(projectDataArchora)) return projectDataArchora;
  if (fs.existsSync(projectDataAnchora)) return projectDataAnchora;

  // 2. Default to Drive D: project data directory
  const defaultProjectDb = path.resolve(process.cwd(), 'data', 'archora.db');
  const projectDataDir = path.dirname(defaultProjectDb);
  if (!fs.existsSync(projectDataDir)) {
    try {
      fs.mkdirSync(projectDataDir, { recursive: true });
    } catch {
      // ignore
    }
  }
  return defaultProjectDb;
}

/**
 * Initializes and returns the active SQLite database handle.
 * Safely creates parent folders if missing.
 */
export function initDb(customPath?: string): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const targetPath = resolveDatabasePath(customPath);
  activeDbPath = targetPath;

  if (targetPath !== ':memory:') {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  dbInstance = new Database(targetPath);

  // Essential SQLite pragmas for data integrity & performance
  if (targetPath !== ':memory:') {
    dbInstance.pragma('journal_mode = WAL');
  }
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('busy_timeout = 5000');
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

/**
 * Gets the singleton database instance. If not initialized, initializes it with defaults.
 */
export function getDb(): DatabaseType {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

/**
 * Closes the active database connection (useful during testing and teardown).
 */
export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      console.warn('[Anchora DB] Error while closing database:', e);
    }
    dbInstance = null;
    activeDbPath = '';
  }
}

/**
 * Returns current active DB path for backend logging (never send to client).
 */
export function getDatabasePath(): string {
  return activeDbPath || resolveDatabasePath();
}
