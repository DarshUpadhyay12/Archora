import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

/**
 * Supported Architectural & Studio File Types
 */
export const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.docx',
  '.doc',
  '.dwg',
  '.dxf',
]);

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/acad',
  'image/vnd.dwg',
  'application/x-dwg',
  'application/dwg',
  'application/dxf',
  'image/vnd.dxf',
  'application/x-autocad',
  'application/octet-stream', // Used by some CAD applications
]);

export const VALID_CATEGORIES = [
  'Architectural Drawings',
  'Floor Plans',
  'Elevations',
  'Sections',
  'Site Analysis',
  'Reference Images',
  'Material References',
  'PDFs and Documents',
  'Other',
] as const;

export type ValidCategory = typeof VALID_CATEGORIES[number];

// Configurable maximum file size (default: 50MB)
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Resolves persistent upload directory.
 * Strictly uses Drive D: storage (process.cwd()/data/uploads) to prevent any writes to full Drive C:.
 */
export function getUploadDirectory(): string {
  if (process.env.UPLOAD_DIR) {
    const customDir = path.resolve(process.env.UPLOAD_DIR);
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    return customDir;
  }

  // Prioritize Drive D: project data directory
  const projectUploads = path.resolve(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(projectUploads)) {
    fs.mkdirSync(projectUploads, { recursive: true });
  }
  return projectUploads;
}

/**
 * Resolves safe temporary directory on Drive D: to avoid writing to full Drive C: temp.
 */
export function getTempDirectory(): string {
  if (process.env.TEMP_DIR) {
    const customDir = path.resolve(process.env.TEMP_DIR);
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    return customDir;
  }

  const projectTemp = path.resolve(process.cwd(), 'data', 'temp');
  if (!fs.existsSync(projectTemp)) {
    fs.mkdirSync(projectTemp, { recursive: true });
  }
  return projectTemp;
}

/**
 * Sanitizes original filenames to prevent path traversal, null bytes, and malicious characters.
 */
export function sanitizeFilename(originalName: string): string {
  if (!originalName || typeof originalName !== 'string') {
    return 'unnamed_file';
  }

  // Strip path traversal sequences and separators
  let clean = path.basename(originalName);
  clean = clean.replace(/[\0\x00-\x1F\x7F<>:"/\\|?*]/g, '_');
  clean = clean.replace(/\.{2,}/g, '.'); // Remove consecutive dots
  clean = clean.replace(/^\.+/, ''); // Remove leading dots

  if (!clean || clean === '.') {
    clean = 'unnamed_document';
  }

  // Limit filename length to 255 chars
  if (clean.length > 255) {
    const ext = path.extname(clean);
    clean = clean.slice(0, 255 - ext.length) + ext;
  }

  return clean;
}

/**
 * Validates file signature (magic numbers) to ensure file content matches extension.
 */
export function validateFileSignature(filePath: string, extension: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const buffer = Buffer.alloc(16);
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
  } catch (err) {
    return false;
  } finally {
    if (fd !== null) {
      fs.closeSync(fd);
    }
  }

  const ext = extension.toLowerCase();

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      // JPEG starts with FF D8 FF
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    case '.png':
      // PNG starts with 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0D &&
        buffer[5] === 0x0A &&
        buffer[6] === 0x1A &&
        buffer[7] === 0x0A
      );

    case '.webp':
      // WebP starts with RIFF (bytes 0-3) and has WEBP at bytes 8-11
      const riff = buffer.toString('ascii', 0, 4);
      const webp = buffer.toString('ascii', 8, 12);
      return riff === 'RIFF' && webp === 'WEBP';

    case '.pdf':
      // PDF starts with %PDF- (25 50 44 46)
      return buffer.toString('ascii', 0, 5).startsWith('%PDF-');

    case '.docx':
      // DOCX is a zip container starting with PK\x03\x04
      return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;

    case '.doc':
      // Classic OLE compound file
      return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;

    case '.dwg':
      // AutoCAD DWG starts with AC10 (e.g. AC1015, AC1018, AC1024, AC1027, AC1032)
      return buffer.toString('ascii', 0, 4).startsWith('AC10');

    case '.dxf':
      // DXF text file typically starts with 0\r\nSECTION or similar text, or AutoCAD Binary DXF
      const dxfStart = buffer.toString('ascii', 0, 16);
      return dxfStart.includes('0') || dxfStart.startsWith('AutoCAD');

    default:
      return false;
  }
}

/**
 * Generates a collision-resistant internal storage filename.
 */
export function generateStorageFilename(ext: string): string {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(12).toString('hex');
  return `archora_file_${timestamp}_${randomHex}${ext.toLowerCase()}`;
}

/**
 * Safely removes a file from physical disk storage.
 */
export function removePhysicalFile(storagePath: string): boolean {
  try {
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn(`[FileStorage] Failed to unlink physical file at ${storagePath}:`, err.message);
    return false;
  }
}

/**
 * Categorizes a file by extension for UI presentation.
 */
export function getFileTypeGroup(ext: string): 'image' | 'pdf' | 'document' | 'drawing' | 'other' {
  const cleanExt = ext.toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(cleanExt)) return 'image';
  if (cleanExt === '.pdf') return 'pdf';
  if (['.docx', '.doc'].includes(cleanExt)) return 'document';
  if (['.dwg', '.dxf'].includes(cleanExt)) return 'drawing';
  return 'other';
}

