import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { backupService, getBackupDirectory } from '../services/backupService';
import { getTempDirectory } from '../services/fileStorageService';
import { settingsRepository } from '../repositories/settingsRepository';
import { backupRateLimiter } from '../middleware/rateLimiter';

export const backupRouter = Router();

// Protect all backup and restore endpoints with studio authentication
backupRouter.use(requireAuth);

// Multer storage for uploaded backup zip archives during restore on Drive D:
const tempRestoreDir = path.join(getTempDirectory(), 'archora_restore_uploads');
if (!fs.existsSync(tempRestoreDir)) {
  fs.mkdirSync(tempRestoreDir, { recursive: true });
}

const restoreUpload = multer({
  dest: tempRestoreDir,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max backup archive
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      return cb(new Error('INVALID_BACKUP_FORMAT: Only .zip backup archives are supported.'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/backup
 * Creates an atomic point-in-time backup archive of database, uploads, and metadata.
 */
backupRouter.post('/', backupRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { customFilename } = req.body || {};

    const result = await backupService.createBackup({
      userId,
      isAutomatic: false,
      customFilename,
    });

    res.status(201).json({
      success: true,
      backup: result.backup,
      manifest: result.manifest,
      filename: result.backup.filename,
      message: 'Backup archive created successfully.',
    });
  } catch (err: any) {
    console.error('[Backup API] Create backup failed:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate backup archive.',
    });
  }
});

/**
 * GET /api/backup/history
 * Returns the list of verified, physically existing backup archives.
 */
backupRouter.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const backups = await backupService.listBackups(userId);
    res.json({
      success: true,
      backups,
      count: backups.length,
    });
  } catch (err: any) {
    console.error('[Backup API] List backups failed:', err);
    res.status(500).json({
      error: 'Failed to retrieve backup history.',
    });
  }
});

/**
 * GET /api/backup/download/:filename
 * Streams the backup ZIP archive for local browser download.
 */
backupRouter.get('/download/:filename', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!filename.endsWith('.zip') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid backup archive filename.' });
    }

    const backupDir = getBackupDirectory();
    const filePath = path.join(backupDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup archive file not found on disk.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    console.error('[Backup API] Download backup failed:', err);
    res.status(500).json({ error: 'Failed to stream backup archive.' });
  }
});

/**
 * POST /api/backup/verify
 * Validates integrity, checksums, and schema version of a backup file.
 */
backupRouter.post('/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename parameter is required.' });
    }

    const cleanFilename = path.basename(filename);
    const backupDir = getBackupDirectory();
    const targetPath = path.join(backupDir, cleanFilename);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Backup archive file not found.' });
    }

    const verification = await backupService.verifyBackup(targetPath);
    res.json({
      success: true,
      ...verification,
    });
  } catch (err: any) {
    console.error('[Backup API] Verification failed:', err);
    res.status(500).json({ error: 'Failed to verify backup archive.' });
  }
});

/**
 * POST /api/backup/restore
 * Staged, transactional restoration with automatic pre-restore safety snapshot.
 * Supports both on-disk backup selection (by filename) and multipart file upload.
 */
backupRouter.post('/restore', backupRateLimiter, restoreUpload.single('backupFile'), async (req: AuthenticatedRequest, res: Response) => {
  let uploadedTempPath: string | null = null;
  try {
    let sourcePath: string;

    if (req.file) {
      uploadedTempPath = req.file.path;
      sourcePath = req.file.path;
    } else if (req.body.filename) {
      const cleanFilename = path.basename(req.body.filename);
      const backupDir = getBackupDirectory();
      sourcePath = path.join(backupDir, cleanFilename);
      if (!fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: 'Selected backup file does not exist on server.' });
      }
    } else {
      return res.status(400).json({
        error: 'Either a filename from backup history or an uploaded backupFile (.zip) is required.',
      });
    }

    // Execute staged restoration
    const result = await backupService.restoreBackup(sourcePath);

    res.json({
      success: true,
      restoredAt: result.restoredAt,
      manifest: result.manifest,
      stats: result.stats,
      message: 'Workspace restored successfully. Active session reloaded.',
    });
  } catch (err: any) {
    console.error('[Backup API] Restore failed:', err);
    res.status(500).json({
      error: err.message || 'Restoration failed. Any changes were safely rolled back.',
    });
  } finally {
    // Clean uploaded temp file if applicable
    if (uploadedTempPath && fs.existsSync(uploadedTempPath)) {
      try {
        fs.unlinkSync(uploadedTempPath);
      } catch (e) {}
    }
  }
});

/**
 * DELETE /api/backup/:filename
 * Safely removes a backup archive from disk and database.
 */
backupRouter.delete('/:filename', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const filename = path.basename(req.params.filename);

    const deleted = await backupService.deleteBackup(filename, userId);
    res.json({
      success: deleted,
      deletedFilename: filename,
      message: 'Backup archive deleted.',
    });
  } catch (err: any) {
    console.error('[Backup API] Delete backup failed:', err);
    res.status(500).json({
      error: err.message || 'Failed to delete backup archive.',
    });
  }
});

/**
 * GET /api/backup/settings
 * Retrieves automatic backup configuration.
 */
backupRouter.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = settingsRepository.getSettings(userId);
    res.json({
      success: true,
      autoBackup: {
        enabled: (settings as any).auto_backup_enabled === 1,
        frequency: (settings as any).auto_backup_frequency || 'daily',
        maxRetained: (settings as any).auto_backup_max_retained || 5,
        destination: (settings as any).auto_backup_destination || getBackupDirectory(),
        lastRun: (settings as any).auto_backup_last_run || null,
      },
    });
  } catch (err: any) {
    console.error('[Backup API] Get settings failed:', err);
    res.status(500).json({ error: 'Failed to retrieve backup settings.' });
  }
});

/**
 * PUT /api/backup/settings
 * Updates automatic backup configuration.
 */
backupRouter.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { enabled, frequency, maxRetained, destination } = req.body;

    const updates: any = {};
    if (typeof enabled === 'boolean') updates.auto_backup_enabled = enabled ? 1 : 0;
    if (['daily', 'weekly', 'manual'].includes(frequency)) updates.auto_backup_frequency = frequency;
    if (typeof maxRetained === 'number') updates.auto_backup_max_retained = Math.max(1, Math.min(50, maxRetained));
    if (typeof destination === 'string') updates.auto_backup_destination = destination.trim();

    const updated = settingsRepository.updateSettings(userId, updates);

    res.json({
      success: true,
      settings: updated,
      message: 'Automatic backup configuration saved.',
    });
  } catch (err: any) {
    console.error('[Backup API] Update settings failed:', err);
    res.status(500).json({ error: 'Failed to update backup settings.' });
  }
});

