import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { googleDriveService } from '../services/googleDriveService';
import { settingsRepository, DEFAULT_GOOGLE_DRIVE_FOLDER_ID } from '../repositories/settingsRepository';

export const googleDriveRouter = Router();

/**
 * GET /api/google/callback
 * OAuth redirect callback from Google.
 * Exchanges authorization code for tokens and redirects browser back to settings.
 * Note: Must be public because Google's redirect carries query params in the browser.
 */
googleDriveRouter.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const stateStr = req.query.state as string;
  const error = req.query.error as string;

  if (error) {
    console.warn('[Google OAuth Callback] Access was denied or cancelled:', error);
    return res.redirect(`/profile?tab=data&gdrive_error=${encodeURIComponent('Google authorization was cancelled or denied.')}`);
  }

  if (!code) {
    return res.redirect(`/profile?tab=data&gdrive_error=${encodeURIComponent('Missing authorization code from Google.')}`);
  }

  let userId: string | null = null;
  try {
    if (stateStr) {
      const parsed = JSON.parse(Buffer.from(stateStr, 'base64url').toString('utf8'));
      userId = parsed.userId || null;
    }
  } catch (e) {
    console.warn('[Google OAuth Callback] Could not parse state parameter:', e);
  }

  if (!userId) {
    return res.redirect(`/profile?tab=data&gdrive_error=${encodeURIComponent('Invalid or expired OAuth state parameter.')}`);
  }

  try {
    const result = await googleDriveService.handleCallback(code, userId);
    const redirectUrl = result.folderVerified
      ? '/profile?tab=data&gdrive=connected&folder=verified'
      : '/profile?tab=data&gdrive=connected&folder=unverified';
    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error('[Google OAuth Callback] Token exchange failed:', err);
    return res.redirect(`/profile?tab=data&gdrive_error=${encodeURIComponent(err.message || 'Token exchange failed.')}`);
  }
});

// All subsequent Google Drive endpoints require user authentication
googleDriveRouter.use(requireAuth);

/**
 * GET /api/google/status
 * Returns Google account connectivity, folder verification status, and folder metadata.
 */
googleDriveRouter.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = await googleDriveService.getStatus(userId);
    res.json({
      success: true,
      status,
    });
  } catch (err: any) {
    console.error('[Google API] Get status failed:', err);
    res.status(500).json({ error: 'Failed to retrieve Google Drive status.' });
  }
});

/**
 * GET /api/google/auth-url
 * Generates Google OAuth authorization URL for the signed-in user.
 */
googleDriveRouter.get('/auth-url', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const statePayload = {
      userId,
      nonce: Math.random().toString(36).substring(2),
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const authUrl = googleDriveService.generateAuthUrl(state);

    res.json({
      success: true,
      authUrl,
    });
  } catch (err: any) {
    console.error('[Google API] Auth URL generation failed:', err);
    res.status(400).json({
      error: err.message || 'Failed to generate Google authorization URL.',
      configured: googleDriveService.isConfigured(),
    });
  }
});

/**
 * POST /api/google/verify-folder
 * Verifies access and write capability for the supplied folder ID (or default folder ID).
 */
googleDriveRouter.post('/verify-folder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { folderId } = req.body || {};

    const targetFolderId = folderId ? folderId.trim() : undefined;
    const result = await googleDriveService.verifyFolder(userId, targetFolderId);

    res.json({
      success: result.exists && result.canAddChildren,
      folder: result,
    });
  } catch (err: any) {
    console.error('[Google API] Verify folder failed:', err);
    res.status(400).json({
      error: err.message || 'Failed to verify Google Drive folder access.',
    });
  }
});

/**
 * POST /api/google/set-folder
 * Updates preferred destination folder ID and re-verifies access.
 */
googleDriveRouter.post('/set-folder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { folderId, folderName } = req.body;

    if (!folderId || typeof folderId !== 'string') {
      return res.status(400).json({ error: 'A valid Google Drive folder ID is required.' });
    }

    const folderInfo = await googleDriveService.setDestinationFolder(userId, folderId, folderName);

    res.json({
      success: folderInfo.exists && folderInfo.canAddChildren,
      folder: folderInfo,
    });
  } catch (err: any) {
    console.error('[Google API] Set folder failed:', err);
    res.status(400).json({ error: err.message || 'Failed to update destination folder.' });
  }
});

/**
 * POST /api/google/backup/upload
 * Creates a complete local backup and uploads it to the configured Google Drive folder.
 */
googleDriveRouter.post('/backup/upload', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { customFilename, folderId } = req.body || {};

    const result = await googleDriveService.uploadBackup(userId, {
      folderId,
      customFilename,
    });

    res.status(201).json({
      success: true,
      cloudBackup: result.cloudBackup,
      webViewLink: result.webViewLink,
      message: `Backup archive "${result.cloudBackup.filename}" uploaded successfully to Google Drive.`,
    });
  } catch (err: any) {
    console.error('[Google API] Cloud backup upload failed:', err);
    res.status(500).json({
      error: err.message || 'Failed to upload backup to Google Drive.',
    });
  }
});

/**
 * GET /api/google/backup/list
 * Lists backup archives stored inside the configured Google Drive folder.
 */
googleDriveRouter.get('/backup/list', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { folderId } = req.query as { folderId?: string };

    const backups = await googleDriveService.listBackups(userId, folderId);
    const settings = settingsRepository.get(userId);

    res.json({
      success: true,
      folderId: folderId || settings.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID,
      folderName: settings.google_drive_folder_name || null,
      folderStatus: settings.google_drive_folder_status || 'unverified',
      count: backups.length,
      backups,
    });
  } catch (err: any) {
    console.error('[Google API] List cloud backups failed:', err);
    res.status(500).json({
      error: err.message || 'Failed to list backups from Google Drive folder.',
      backups: [],
    });
  }
});

/**
 * GET /api/google/backup/download/:fileId
 * Streams a backup archive from Google Drive to the user's browser.
 */
googleDriveRouter.get('/backup/download/:fileId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    const downloaded = await googleDriveService.downloadBackup(userId, fileId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${downloaded.filename}"`);
    res.setHeader('Content-Length', downloaded.size);
    res.send(downloaded.buffer);
  } catch (err: any) {
    console.error('[Google API] Download cloud backup failed:', err);
    res.status(500).json({ error: 'Failed to download backup from Google Drive.' });
  }
});

/**
 * POST /api/google/backup/verify/:fileId
 * Downloads cloud archive and runs full checksum and integrity checks.
 */
googleDriveRouter.post('/backup/verify/:fileId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    const verification = await googleDriveService.verifyCloudBackup(userId, fileId);
    res.json({
      success: verification.valid,
      verification,
    });
  } catch (err: any) {
    console.error('[Google API] Verify cloud backup failed:', err);
    res.status(400).json({ error: err.message || 'Failed to verify cloud backup integrity.' });
  }
});

/**
 * POST /api/google/backup/restore/:fileId
 * Restores workspace from a selected Google Drive backup using the staged 10-step safe engine.
 */
googleDriveRouter.post('/backup/restore/:fileId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    const restoreResult = await googleDriveService.restoreFromCloudBackup(userId, fileId);

    res.json({
      success: true,
      message: 'Workspace successfully restored from Google Drive backup.',
      result: restoreResult,
    });
  } catch (err: any) {
    console.error('[Google API] Restore from cloud backup failed:', err);
    res.status(500).json({ error: err.message || 'Failed to restore workspace from cloud backup.' });
  }
});

/**
 * DELETE /api/google/backup/:fileId
 * Deletes a backup from the designated Google Drive folder.
 */
googleDriveRouter.delete('/backup/:fileId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileId } = req.params;

    await googleDriveService.deleteCloudBackup(userId, fileId);

    res.json({
      success: true,
      message: 'Backup deleted successfully from Google Drive.',
    });
  } catch (err: any) {
    console.error('[Google API] Delete cloud backup failed:', err);
    res.status(500).json({ error: err.message || 'Failed to delete backup from Google Drive.' });
  }
});

/**
 * POST /api/google/disconnect
 * Disconnects Google account and clears stored tokens from SQLite.
 */
googleDriveRouter.post('/disconnect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await googleDriveService.disconnect(userId);

    res.json({
      success: true,
      message: 'Google Drive disconnected successfully.',
    });
  } catch (err: any) {
    console.error('[Google API] Disconnect failed:', err);
    res.status(500).json({ error: 'Failed to disconnect Google Drive.' });
  }
});

