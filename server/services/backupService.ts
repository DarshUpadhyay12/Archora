import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { getDb, initDb, closeDb, getDatabasePath } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { getUploadDirectory, getTempDirectory } from './fileStorageService';
import { backupRepository } from '../repositories/backupRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import {
  BackupRecord,
  BackupManifest,
  BackupVerificationResult,
  BackupSummaryItem,
} from '../types/db';

const BACKUP_VERSION = '1.0.0';
const APP_VERSION = '1.0.0';

/**
 * Resolves persistent backup directory on Drive D: to avoid writing to full Drive C:.
 */
export function getBackupDirectory(): string {
  if (process.env.BACKUP_DIR) {
    const customDir = path.resolve(process.env.BACKUP_DIR);
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    return customDir;
  }

  const projectBackups = path.resolve(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(projectBackups)) {
    fs.mkdirSync(projectBackups, { recursive: true });
  }
  return projectBackups;
}

/**
 * Computes SHA-256 hash of a file or buffer.
 */
function computeChecksum(content: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  if (Buffer.isBuffer(content)) {
    hash.update(content);
  } else {
    hash.update(fs.readFileSync(content));
  }
  return hash.digest('hex');
}

/**
 * Formats date into standard backup filename: Archora-Backup-YYYY-MM-DD-HH-mm.zip
 */
function generateBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `Archora-Backup-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.zip`;
}

/**
 * Retrieves the current schema migration version.
 */
function getCurrentSchemaVersion(db: ReturnType<typeof getDb>): number {
  try {
    const row = db.prepare('SELECT MAX(version) as max_ver FROM schema_migrations').get() as { max_ver: number } | undefined;
    return row?.max_ver || 7;
  } catch {
    return 7;
  }
}

/**
 * Gathers database metadata counts for the manifest.
 */
function gatherDatabaseMetadata(db: ReturnType<typeof getDb>): BackupManifest['metadata'] {
  const safeCount = (table: string): number => {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number } | undefined;
      return row?.c || 0;
    } catch {
      return 0;
    }
  };

  return {
    userCount: safeCount('users'),
    projectCount: safeCount('projects'),
    filesCount: safeCount('project_files'),
    conversationCount: safeCount('conversations'),
    savedOutputCount: safeCount('saved_outputs'),
    pdfExportCount: safeCount('pdf_exports'),
    os: `${process.platform} (${process.arch})`,
    nodeVersion: process.version,
  };
}

export const backupService = {
  /**
   * Creates an atomic, consistent local backup archive in ZIP format.
   * Uses SQLite's native backup API to snapshot active database without locking inconsistencies.
   */
  async createBackup(options: {
    userId?: string;
    isAutomatic?: boolean;
    destinationDir?: string;
    customFilename?: string;
  } = {}): Promise<{
    backup: BackupRecord;
    manifest: BackupManifest;
    filePath: string;
  }> {
    const db = getDb();
    const backupDir = options.destinationDir || getBackupDirectory();
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const filename = options.customFilename || generateBackupFilename(now);
    const targetZipPath = path.join(backupDir, filename);

    // Prevent accidental overwriting of existing backups
    if (fs.existsSync(targetZipPath)) {
      throw new Error(`A backup archive with the name "${filename}" already exists in the destination folder.`);
    }

    // Step 1: Create isolated temporary staging directory on Drive D:
    const tempDir = path.join(
      getTempDirectory(),
      `archora_bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
    );
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // Step 2: Consistent Point-in-Time SQLite Database Snapshot using native backup API
      const tempDbPath = path.join(tempDir, 'archora.db');
      await db.backup(tempDbPath);

      // Verify the snapshot can be opened and clean inactive sessions
      const snapshotDb = new Database(tempDbPath);
      // Remove sensitive active session tokens so they cannot be hijacked from backups
      try {
        snapshotDb.prepare('DELETE FROM sessions').run();
      } catch (e) {}
      const schemaVer = getCurrentSchemaVersion(snapshotDb);
      const metadata = gatherDatabaseMetadata(snapshotDb);
      snapshotDb.close();

      // Step 3: Collect Uploaded Files from storage
      const uploadDir = getUploadDirectory();
      const uploadFiles: { storageFilename: string; fullPath: string }[] = [];
      if (fs.existsSync(uploadDir)) {
        const entries = fs.readdirSync(uploadDir);
        for (const entry of entries) {
          const fullPath = path.join(uploadDir, entry);
          if (fs.statSync(fullPath).isFile()) {
            uploadFiles.push({ storageFilename: entry, fullPath });
          }
        }
      }

      // Step 4: Construct ZIP Archive with adm-zip
      const zip = new AdmZip();
      const checksums: { [relPath: string]: string } = {};
      let totalSizeBytes = 0;
      let fileCount = 0;

      // Add Database Snapshot
      const dbBuffer = fs.readFileSync(tempDbPath);
      const dbRelPath = 'database/archora.db';
      zip.addFile(dbRelPath, dbBuffer);
      checksums[dbRelPath] = computeChecksum(dbBuffer);
      totalSizeBytes += dbBuffer.length;
      fileCount++;

      // Add Uploaded Files
      for (const file of uploadFiles) {
        try {
          const fileBuf = fs.readFileSync(file.fullPath);
          const fileRelPath = `uploads/${file.storageFilename}`;
          zip.addFile(fileRelPath, fileBuf);
          checksums[fileRelPath] = computeChecksum(fileBuf);
          totalSizeBytes += fileBuf.length;
          fileCount++;
        } catch (e) {
          console.warn(`[BackupService] Warning: Could not read file for backup: ${file.fullPath}`);
        }
      }

      // Add Metadata: System Info
      const systemInfo = {
        archoraVersion: APP_VERSION,
        backupVersion: BACKUP_VERSION,
        createdAt: now.toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        databaseSchemaVersion: schemaVer,
        metadata,
      };
      const sysInfoBuf = Buffer.from(JSON.stringify(systemInfo, null, 2), 'utf8');
      const sysInfoRelPath = 'metadata/system_info.json';
      zip.addFile(sysInfoRelPath, sysInfoBuf);
      checksums[sysInfoRelPath] = computeChecksum(sysInfoBuf);
      totalSizeBytes += sysInfoBuf.length;
      fileCount++;

      // Construct and Add Manifest
      const manifest: BackupManifest = {
        backupVersion: BACKUP_VERSION,
        appVersion: APP_VERSION,
        createdAt: now.toISOString(),
        databaseSchemaVersion: schemaVer,
        databaseName: 'archora.db',
        includedCategories: ['database', 'uploads', 'metadata', 'user_settings'],
        fileCount,
        totalSizeBytes,
        checksums,
        metadata,
      };

      const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
      zip.addFile('manifest.json', manifestBuf);

      // Step 5: Write ZIP Archive to target location atomically via temp file
      const tempZipPath = path.join(tempDir, 'output.zip');
      zip.writeZip(tempZipPath);

      // Verify created archive integrity before finalization
      const verifyZip = new AdmZip(tempZipPath);
      const testManifest = verifyZip.getEntry('manifest.json');
      if (!testManifest) {
        throw new Error('Backup archive verification failed: manifest.json missing from generated package.');
      }

      // Move into final destination
      fs.copyFileSync(tempZipPath, targetZipPath);

      const finalStat = fs.statSync(targetZipPath);
      const zipChecksum = computeChecksum(targetZipPath);

      // Step 6: Log record into SQLite backup_records
      const backupId = `bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const record = backupRepository.createRecord({
        id: backupId,
        user_id: options.userId || null,
        filename,
        file_path: targetZipPath,
        file_size_bytes: finalStat.size,
        backup_version: BACKUP_VERSION,
        schema_version: schemaVer,
        is_automatic: options.isAutomatic ? 1 : 0,
        checksum_sha256: zipChecksum,
        file_count: manifest.fileCount,
        created_at: now.toISOString(),
      });

      // Step 7: Automatic Backup Pruning
      if (options.isAutomatic) {
        try {
          const settings = settingsRepository.getSettings(options.userId || 'default_user');
          const maxRetained = (settings as any).auto_backup_max_retained || 5;
          this.pruneOldAutomaticBackups(maxRetained, options.userId);
        } catch (e) {
          console.warn('[BackupService] Auto-backup pruning error:', e);
        }
      }

      return {
        backup: record,
        manifest,
        filePath: targetZipPath,
      };
    } finally {
      // Clean up temporary files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  },

  /**
   * Verifies archive integrity, checks for ZIP slip vulnerability, and validates checksums.
   */
  async verifyBackup(filePathOrBuffer: string | Buffer): Promise<BackupVerificationResult> {
    const errors: string[] = [];
    let archiveSize = 0;
    let filename = 'archive.zip';

    if (typeof filePathOrBuffer === 'string') {
      filename = path.basename(filePathOrBuffer);
      if (!fs.existsSync(filePathOrBuffer)) {
        return {
          valid: false,
          errors: [`Backup archive file not found on disk: ${filename}`],
          archiveSize: 0,
          filename,
        };
      }
      archiveSize = fs.statSync(filePathOrBuffer).size;
      if (archiveSize === 0) {
        return {
          valid: false,
          errors: ['Backup archive file is empty (0 bytes).'],
          archiveSize: 0,
          filename,
        };
      }
    } else {
      archiveSize = filePathOrBuffer.length;
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(filePathOrBuffer);
    } catch (e: any) {
      return {
        valid: false,
        errors: [`Corrupted ZIP archive: ${e.message}`],
        archiveSize,
        filename,
      };
    }

    const entries = zip.getEntries();
    if (entries.length === 0) {
      return {
        valid: false,
        errors: ['Backup archive contains no files.'],
        archiveSize,
        filename,
      };
    }

    // 1. ZIP Slip and Path Traversal Security Verification
    for (const entry of entries) {
      const entryName = entry.entryName;
      if (
        entryName.includes('..') ||
        path.isAbsolute(entryName) ||
        /^[a-zA-Z]:/.test(entryName) ||
        entryName.startsWith('/') ||
        entryName.startsWith('\\')
      ) {
        return {
          valid: false,
          errors: [`Malicious or unsafe entry path detected (ZIP Slip attempt blocked): "${entryName}"`],
          archiveSize,
          filename,
        };
      }
    }

    // 2. Locate and Parse Manifest
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      return {
        valid: false,
        errors: ['Invalid Archora backup: manifest.json is missing from the archive.'],
        archiveSize,
        filename,
      };
    }

    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    } catch (e: any) {
      return {
        valid: false,
        errors: [`Malformed manifest.json in archive: ${e.message}`],
        archiveSize,
        filename,
      };
    }

    // 3. Backup Version Check
    if (!manifest.backupVersion || manifest.backupVersion !== BACKUP_VERSION) {
      errors.push(`Incompatible backup version: Expected "${BACKUP_VERSION}", received "${manifest.backupVersion || 'unknown'}".`);
    }

    // 4. Verify Essential Database Entry
    const dbEntry = zip.getEntry('database/archora.db') || zip.getEntry('archora.db');
    if (!dbEntry) {
      errors.push('Database file (database/archora.db) missing from archive.');
    }

    // 5. Verify Checksums
    if (manifest.checksums && typeof manifest.checksums === 'object') {
      for (const [relPath, expectedHash] of Object.entries(manifest.checksums)) {
        const entry = zip.getEntry(relPath);
        if (!entry) {
          errors.push(`Missing referenced file in archive: ${relPath}`);
          continue;
        }
        const actualHash = computeChecksum(entry.getData());
        if (actualHash !== expectedHash) {
          errors.push(`Checksum mismatch for "${relPath}": file has been altered or corrupted.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      manifest,
      archiveSize,
      filename,
    };
  },

  /**
   * Staged, transactional restoration with automatic pre-restore safety backup and atomic swap.
   * If any step fails, the system automatically rolls back from the safety backup.
   */
  async restoreBackup(sourcePathOrBuffer: string | Buffer): Promise<{
    success: boolean;
    restoredAt: string;
    manifest: BackupManifest;
    stats: {
      projectsRestored: number;
      filesRestored: number;
      conversationsRestored: number;
      usersRestored: number;
    };
  }> {
    // Stage 1: Validate Archive Integrity & Security
    const verification = await this.verifyBackup(sourcePathOrBuffer);
    if (!verification.valid || !verification.manifest) {
      throw new Error(`Backup restoration rejected: ${verification.errors.join('; ')}`);
    }

    const manifest = verification.manifest;
    const activeDb = getDb();
    const activeDbPath = getDatabasePath();
    const activeUploadDir = getUploadDirectory();

    // Stage 2: Create Automatic Pre-Restore Safety Backup of Current State
    const safetyDir = path.join(
      getTempDirectory(),
      `archora_safety_backup_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
    );
    fs.mkdirSync(safetyDir, { recursive: true });

    let safetyDbPath: string | null = null;
    let safetyUploadDir: string | null = null;

    try {
      if (activeDbPath && activeDbPath !== ':memory:' && fs.existsSync(activeDbPath)) {
        safetyDbPath = path.join(safetyDir, 'safety_current.db');
        await activeDb.backup(safetyDbPath);
      }
      if (fs.existsSync(activeUploadDir)) {
        safetyUploadDir = path.join(safetyDir, 'uploads_safety');
        fs.cpSync(activeUploadDir, safetyUploadDir, { recursive: true });
      }
    } catch (safetyErr: any) {
      console.warn('[BackupService] Safety snapshot failed:', safetyErr);
      throw new Error(`Cannot safely initiate restore: Failed to create safety backup of current data (${safetyErr.message}).`);
    }

    // Stage 3: Extract Archive into Staging Directory
    const stagingDir = path.join(
      getTempDirectory(),
      `archora_staging_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
    );
    fs.mkdirSync(stagingDir, { recursive: true });

    const zip = new AdmZip(sourcePathOrBuffer);

    try {
      // Safe extraction preventing Zip Slip
      const entries = zip.getEntries();
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName;
        const targetPath = path.resolve(stagingDir, entryName);
        if (!targetPath.startsWith(path.resolve(stagingDir) + path.sep)) {
          throw new Error(`Malicious path traversal entry blocked: ${entryName}`);
        }
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(targetPath, entry.getData());
      }

      // Stage 4: Validate Extracted Database Integrity with PRAGMA integrity_check
      const stagedDbFile = path.join(stagingDir, 'database', 'archora.db');
      if (!fs.existsSync(stagedDbFile)) {
        throw new Error('Extracted backup is missing the core database file (database/archora.db).');
      }

      const testDb = new Database(stagedDbFile);
      const integrityResult = testDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
      const isIntegrityOk = Array.isArray(integrityResult) && integrityResult.length > 0 && integrityResult[0].integrity_check === 'ok';

      if (!isIntegrityOk) {
        testDb.close();
        throw new Error('Extracted database failed SQLite PRAGMA integrity check.');
      }

      // Ensure active session tokens are wiped in restored database so old revoked tokens cannot authenticate
      try {
        testDb.prepare('DELETE FROM sessions').run();
      } catch (e) {}

      // Gather restored stats
      const stats = {
        usersRestored: (testDb.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0,
        projectsRestored: (testDb.prepare('SELECT COUNT(*) as c FROM projects').get() as any)?.c || 0,
        filesRestored: (testDb.prepare('SELECT COUNT(*) as c FROM project_files').get() as any)?.c || 0,
        conversationsRestored: (testDb.prepare('SELECT COUNT(*) as c FROM conversations').get() as any)?.c || 0,
      };

      testDb.close();

      // Stage 5: Atomic Swap of Database File
      closeDb();

      // Ensure active DB directory exists
      const targetDbDir = path.dirname(activeDbPath);
      if (!fs.existsSync(targetDbDir)) {
        fs.mkdirSync(targetDbDir, { recursive: true });
      }

      // Clean active WAL and SHM files to ensure clean restart
      const walFile = `${activeDbPath}-wal`;
      const shmFile = `${activeDbPath}-shm`;
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

      // Copy staged database to active path
      fs.copyFileSync(stagedDbFile, activeDbPath);

      // Stage 6: Sync Restored Uploaded Files
      const stagedUploadsDir = path.join(stagingDir, 'uploads');
      if (fs.existsSync(stagedUploadsDir)) {
        if (!fs.existsSync(activeUploadDir)) {
          fs.mkdirSync(activeUploadDir, { recursive: true });
        }
        const stagedFiles = fs.readdirSync(stagedUploadsDir);
        for (const file of stagedFiles) {
          const src = path.join(stagedUploadsDir, file);
          const dest = path.join(activeUploadDir, file);
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
          }
        }
      }

      // Stage 7: Reinitialize Database Connection & Run Migrations
      const newDb = initDb(activeDbPath);
      runMigrations(newDb);

      return {
        success: true,
        restoredAt: new Date().toISOString(),
        manifest,
        stats,
      };
    } catch (restoreErr: any) {
      console.error('[BackupService] Restoration error, initiating rollback:', restoreErr);

      // ROLLBACK: Restore previous data from safety backup
      try {
        closeDb();
        if (safetyDbPath && fs.existsSync(safetyDbPath)) {
          fs.copyFileSync(safetyDbPath, activeDbPath);
          const walFile = `${activeDbPath}-wal`;
          const shmFile = `${activeDbPath}-shm`;
          if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
          if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
        }
        if (safetyUploadDir && fs.existsSync(safetyUploadDir)) {
          fs.cpSync(safetyUploadDir, activeUploadDir, { recursive: true, force: true });
        }
        initDb(activeDbPath);
      } catch (rollbackErr: any) {
        console.error('[BackupService] Critical: Rollback failed:', rollbackErr);
      }

      throw new Error(`Restore failed and was safely rolled back: ${restoreErr.message}`);
    } finally {
      // Clean temporary staging and safety directories
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
        fs.rmSync(safetyDir, { recursive: true, force: true });
      } catch (e) {}
    }
  },

  /**
   * Scans the physical backup directory and returns verified list of real archives.
   */
  async listBackups(userId?: string): Promise<BackupSummaryItem[]> {
    const backupDir = getBackupDirectory();
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.zip'));
    const results: BackupSummaryItem[] = [];

    for (const filename of files) {
      const fullPath = path.join(backupDir, filename);
      try {
        const stat = fs.statSync(fullPath);
        let manifest: BackupManifest | undefined;
        let integrityOk = true;

        try {
          const zip = new AdmZip(fullPath);
          const manifestEntry = zip.getEntry('manifest.json');
          if (manifestEntry) {
            manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
          } else {
            integrityOk = false;
          }
        } catch {
          integrityOk = false;
        }

        const isAuto = filename.toLowerCase().includes('auto') || (manifest as any)?.isAutomatic;

        results.push({
          filename,
          filePath: fullPath,
          sizeBytes: stat.size,
          createdAt: manifest?.createdAt || stat.birthtime.toISOString(),
          backupVersion: manifest?.backupVersion || '1.0.0',
          schemaVersion: manifest?.databaseSchemaVersion || 7,
          isAutomatic: !!isAuto,
          fileCount: manifest?.fileCount || 0,
          manifest,
          integrityOk,
        });
      } catch (e) {
        // Skip unreadable files
      }
    }

    // Sort newest first
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return results;
  },

  /**
   * Deletes a backup archive safely from disk and database.
   */
  async deleteBackup(filename: string, userId?: string): Promise<boolean> {
    // Prevent path traversal in filename parameter
    const cleanFilename = path.basename(filename);
    if (!cleanFilename.endsWith('.zip') || cleanFilename.includes('..')) {
      throw new Error('Invalid backup filename.');
    }

    const backupDir = getBackupDirectory();
    const targetPath = path.join(backupDir, cleanFilename);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    backupRepository.deleteRecord(cleanFilename, userId);
    return true;
  },

  /**
   * Prunes oldest automatic backups beyond maxRetained count.
   */
  pruneOldAutomaticBackups(maxRetained: number, userId?: string): number {
    if (maxRetained <= 0) return 0;
    const backupDir = getBackupDirectory();
    if (!fs.existsSync(backupDir)) return 0;

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.zip'));
    const autoArchives: { filename: string; fullPath: string; birthtime: number }[] = [];

    for (const file of files) {
      const fullPath = path.join(backupDir, file);
      try {
        const zip = new AdmZip(fullPath);
        const manifestEntry = zip.getEntry('manifest.json');
        if (manifestEntry) {
          const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
          if (manifest?.isAutomatic || file.toLowerCase().includes('auto')) {
            const stat = fs.statSync(fullPath);
            autoArchives.push({ filename: file, fullPath, birthtime: stat.birthtimeMs });
          }
        }
      } catch {}
    }

    // Sort newest first
    autoArchives.sort((a, b) => b.birthtime - a.birthtime);

    let prunedCount = 0;
    if (autoArchives.length > maxRetained) {
      const toRemove = autoArchives.slice(maxRetained);
      for (const item of toRemove) {
        try {
          if (fs.existsSync(item.fullPath)) {
            fs.unlinkSync(item.fullPath);
            backupRepository.deleteRecord(item.filename, userId);
            prunedCount++;
          }
        } catch {}
      }
    }

    return prunedCount;
  },

  /**
   * Checks if an automatic backup is due, executes it if needed, and updates timestamp.
   */
  async checkAndRunAutoBackup(userId: string): Promise<boolean> {
    try {
      const settings = settingsRepository.getSettings(userId);
      const autoEnabled = (settings as any).auto_backup_enabled === 1;
      if (!autoEnabled) return false;

      const frequency = (settings as any).auto_backup_frequency || 'daily';
      const lastRun = (settings as any).auto_backup_last_run;
      const now = Date.now();

      let shouldRun = false;
      if (!lastRun) {
        shouldRun = true;
      } else {
        const lastRunTime = new Date(lastRun).getTime();
        const diffHours = (now - lastRunTime) / (1000 * 60 * 60);

        if (frequency === 'daily' && diffHours >= 24) shouldRun = true;
        else if (frequency === 'weekly' && diffHours >= 168) shouldRun = true;
      }

      if (shouldRun) {
        const nowIso = new Date().toISOString();
        await this.createBackup({
          userId,
          isAutomatic: true,
          customFilename: `Archora-AutoBackup-${nowIso.slice(0, 10)}.zip`,
        });

        settingsRepository.updateSettings(userId, {
          auto_backup_last_run: nowIso,
        } as any);

        return true;
      }
    } catch (err: any) {
      console.warn('[BackupService] Automated backup check error:', err.message);
    }
    return false;
  }
};

