import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { uploadRateLimiter } from '../middleware/rateLimiter';
import { fileRepository } from '../repositories/fileRepository';
import { projectRepository } from '../repositories/projectRepository';
import { googleDriveStorageService } from '../services/googleDriveStorageService';
import {
  getUploadDirectory,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  VALID_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  sanitizeFilename,
  validateFileSignature,
  generateStorageFilename,
  removePhysicalFile,
} from '../services/fileStorageService';

export const fileRouter = Router();

// Configure Multer storage to write directly to persistent uploads directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = getUploadDirectory();
      cb(null, uploadDir);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const storageName = generateStorageFilename(ext);
    cb(null, storageName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10, // Max 10 files per batch
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new Error(
          `UNSUPPORTED_TYPE: File extension "${ext}" is not supported. Supported extensions: JPG, JPEG, PNG, WEBP, PDF, DOCX, DOC, DWG, DXF.`
        )
      );
    }
    cb(null, true);
  },
});

// Middleware for Multer error handling (catches size limit, type errors cleanly)
function handleUploadMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  upload.array('files', 10)(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: `File is too large. Maximum allowed file size is ${MAX_FILE_SIZE_MB} MB.`,
          });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }
    next();
  });
}

// All file management endpoints require authenticated studio session
fileRouter.use(requireAuth);

/**
 * GET /api/files/storage/summary
 * Returns local DB size, Google Drive cloud storage usage, disk space saved, and host disk free space.
 */
fileRouter.get('/storage/summary', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const summary = googleDriveStorageService.getStorageOverview(userId);
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve storage overview.' });
  }
});

/**
 * POST /api/files/upload
 * Uploads one or multiple architectural files with validation, magic number checks, and project linking.
 * If Google Drive is connected, files are uploaded directly to the user's Google Drive folder
 * and physical files are unlinked to protect limited local storage (< 10 GB).
 */
fileRouter.post('/upload', uploadRateLimiter, handleUploadMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uploadedFiles = req.files as Express.Multer.File[] | undefined;
  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'No files provided for upload.' });
  }

  const userId = req.user!.id;
  const projectId = typeof req.body.project_id === 'string' && req.body.project_id.trim()
    ? req.body.project_id.trim()
    : null;
  const category = typeof req.body.category === 'string' && req.body.category.trim()
    ? req.body.category.trim()
    : 'Other';
  const description = typeof req.body.description === 'string'
    ? req.body.description.trim()
    : '';

  // Validate project ownership if projectId is specified
  if (projectId) {
    const project = projectRepository.findById(projectId, userId);
    if (!project) {
      // Clean up uploaded physical files
      uploadedFiles.forEach((f) => removePhysicalFile(f.path));
      return res.status(404).json({ error: 'Target project not found or access denied.' });
    }
  }

  const createdRecords = [];

  try {
    for (const file of uploadedFiles) {
      const ext = path.extname(file.originalname).toLowerCase();

      // 1. Validate file signature / magic numbers
      const isValidSignature = validateFileSignature(file.path, ext);
      if (!isValidSignature) {
        removePhysicalFile(file.path);
        throw new Error(
          `CORRUPTED_OR_DISGUISED_FILE: The contents of "${file.originalname}" do not match the expected signature for ${ext} files.`
        );
      }

      // 2. Upload file via GoogleDriveStorageService (handles cloud vs local & low storage unlinking)
      const uploadResult = await googleDriveStorageService.uploadProjectFile(
        userId,
        file.path,
        file.originalname,
        file.mimetype || 'application/octet-stream',
        {
          projectId,
          category,
          description,
          removeLocalAfterUpload: true, // Conserve local disk (<10 GB strategy)
        }
      );

      createdRecords.push(uploadResult.fileRecord);
    }

    return res.status(201).json({
      success: true,
      message: `Successfully uploaded ${createdRecords.length} file(s).`,
      count: createdRecords.length,
      files: createdRecords,
    });
  } catch (err: any) {
    // Transactional rollback: Remove any newly written physical files if database operations fail
    uploadedFiles.forEach((f) => removePhysicalFile(f.path));
    return res.status(400).json({
      error: err.message || 'Failed to complete file upload.',
    });
  }
});

/**
 * GET /api/files
 * Lists user files with multi-criteria filtering, search, and sorting.
 */
fileRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const fileTypeGroup = typeof req.query.fileType === 'string'
      ? (req.query.fileType as 'image' | 'pdf' | 'document' | 'drawing' | 'other')
      : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const sortBy = typeof req.query.sortBy === 'string'
      ? (req.query.sortBy as 'newest' | 'oldest' | 'filename' | 'size')
      : 'newest';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const files = fileRepository.findByUser(userId, {
      projectId,
      category,
      fileTypeGroup,
      search,
      sortBy,
      sortOrder,
    });

    return res.json({
      files,
      count: files.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list files.' });
  }
});

/**
 * GET /api/files/:id
 * Retrieves metadata for a single file.
 */
fileRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = fileRepository.findById(req.params.id, userId);
    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }
    return res.json({ file });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve file metadata.' });
  }
});

/**
 * GET /api/files/:id/preview
 * Streams authorized file for inline display (e.g. image, PDF).
 * If stored in Google Drive (`cloud_only`), streams directly from Google Drive API with zero local disk footprint.
 */
fileRouter.get('/:id/preview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = fileRepository.findById(req.params.id, userId);
    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }

    if (file.cloud_storage_status === 'cloud_only' && file.google_drive_file_id) {
      return await googleDriveStorageService.streamFileFromDrive(userId, file, res, { asAttachment: false });
    }

    // Local file fallback
    if (!fs.existsSync(file.storage_path)) {
      if (file.google_drive_file_id) {
        // Recover by streaming from Drive
        return await googleDriveStorageService.streamFileFromDrive(userId, file, res, { asAttachment: false });
      }
      return res.status(404).json({ error: 'Physical file not found in studio storage.' });
    }

    // Security & delivery headers
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');

    const stream = fs.createReadStream(file.storage_path);
    stream.on('error', (err) => {
      console.error('[FileStream] Error streaming preview:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file preview.' });
      }
    });

    stream.pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to deliver preview.' });
  }
});

/**
 * GET /api/files/:id/download
 * Downloads original file with appropriate attachment disposition.
 * If stored in Google Drive, streams directly without creating permanent local copies.
 */
fileRouter.get('/:id/download', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = fileRepository.findById(req.params.id, userId);
    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }

    if (file.cloud_storage_status === 'cloud_only' && file.google_drive_file_id) {
      return await googleDriveStorageService.streamFileFromDrive(userId, file, res, { asAttachment: true });
    }

    if (!fs.existsSync(file.storage_path)) {
      if (file.google_drive_file_id) {
        return await googleDriveStorageService.streamFileFromDrive(userId, file, res, { asAttachment: true });
      }
      return res.status(404).json({ error: 'Physical file not found in studio storage.' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(file.storage_path);
    stream.pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to download file.' });
  }
});

/**
 * PUT /api/files/:id
 * Updates file metadata (display filename, description, category, project association).
 */
fileRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = fileRepository.findById(req.params.id, userId);
    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }

    const { original_filename, description, category, project_id } = req.body;

    // Validate project if reassigned
    if (project_id !== undefined && project_id !== null && project_id !== '') {
      const project = projectRepository.findById(project_id, userId);
      if (!project) {
        return res.status(404).json({ error: 'Assigned project not found or access denied.' });
      }
    }

    const cleanFilename = original_filename ? sanitizeFilename(original_filename) : undefined;

    const updated = fileRepository.update(req.params.id, userId, {
      original_filename: cleanFilename,
      description: typeof description === 'string' ? description.trim() : undefined,
      category: typeof category === 'string' ? category.trim() : undefined,
      project_id: project_id !== undefined ? (project_id || null) : undefined,
    });

    return res.json({
      success: true,
      message: 'File metadata updated successfully.',
      file: updated,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update file metadata.' });
  }
});

/**
 * DELETE /api/files/:id
 * Deletes database record, unlinks local copy, and deletes cloud file in Google Drive.
 */
fileRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = fileRepository.findById(req.params.id, userId);
    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }

    const result = await googleDriveStorageService.deleteProjectFile(userId, req.params.id);

    return res.json({
      success: true,
      message: result.message,
      cloudDeleted: result.cloudDeleted,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete file.' });
  }
});
