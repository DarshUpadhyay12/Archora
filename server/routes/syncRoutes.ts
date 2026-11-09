import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { backupRateLimiter } from '../middleware/rateLimiter';
import { googleDriveStorageService } from '../services/googleDriveStorageService';
import { syncRepository } from '../repositories/syncRepository';

export const syncRouter = Router();

// All sync endpoints require authenticated studio session
syncRouter.use(requireAuth);

/**
 * GET /api/sync/status
 * Retrieves current cloud synchronization status, pending offline queue count, and storage metrics.
 */
syncRouter.get('/status', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const syncState = syncRepository.getSyncState(userId);
    const pendingQueue = syncRepository.getPendingQueue(userId);
    const storage = googleDriveStorageService.getStorageOverview(userId);

    return res.json({
      syncState: syncState || {
        user_id: userId,
        sync_status: 'idle',
        last_sync_at: null,
        snapshot_drive_file_id: null,
        snapshot_version: 0,
        total_synced_projects: 0,
        total_synced_conversations: 0,
        total_synced_files: 0,
        auto_sync_enabled: 1,
        error_message: null,
      },
      pendingQueueCount: pendingQueue.length,
      storage,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve synchronization status.' });
  }
});

/**
 * POST /api/sync/now
 * Manually triggers an immediate website data synchronization snapshot upload to Google Drive.
 */
syncRouter.post('/now', backupRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await googleDriveStorageService.uploadWebsiteDataSnapshot(userId);

    return res.json({
      success: true,
      message: `Website data synchronized successfully with Google Drive (Snapshot v${result.version}).`,
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Failed to synchronize website data with Google Drive.',
    });
  }
});

/**
 * POST /api/sync/pull
 * Restores website data from a specified Google Drive snapshot manifest.
 */
syncRouter.post('/pull', backupRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { snapshotDriveFileId } = req.body;

    if (!snapshotDriveFileId || typeof snapshotDriveFileId !== 'string') {
      return res.status(400).json({ error: 'Valid snapshotDriveFileId must be provided.' });
    }

    const result = await googleDriveStorageService.restoreWebsiteDataSnapshot(userId, snapshotDriveFileId);

    return res.json({
      success: true,
      message: 'Website data restored successfully from Google Drive snapshot.',
      restored: result,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Failed to restore website data from snapshot.',
    });
  }
});

/**
 * POST /api/sync/process-queue
 * Replays any pending offline sync queue actions (file uploads, deletions, data snapshots).
 */
syncRouter.post('/process-queue', backupRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await googleDriveStorageService.processOfflineSyncQueue(userId);

    return res.json({
      success: true,
      message: `Processed ${result.processed} queued actions.`,
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Failed to process offline synchronization queue.',
    });
  }
});

