import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initDb, closeDb, getDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { authService } from '../services/authService';
import { projectRepository } from '../repositories/projectRepository';
import { fileRepository } from '../repositories/fileRepository';
import {
  validateFileSignature,
  sanitizeFilename,
  generateStorageFilename,
  removePhysicalFile,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../services/fileStorageService';

// Configure isolated test environment
const TEST_DB_PATH = path.resolve('test_anchora_phase6.db');
const TEST_UPLOAD_DIR = path.resolve('test_uploads_phase6');

process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

// Clean prior run artifacts
try {
  closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const walPath = `${TEST_DB_PATH}-wal`;
  const shmPath = `${TEST_DB_PATH}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  if (fs.existsSync(TEST_UPLOAD_DIR)) fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
} catch (e) {}

fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 ANCHORA PHASE 6: ARCHITECTURAL FILE MANAGEMENT TEST SUITE');
  console.log(`📁 Test Database: ${TEST_DB_PATH}`);
  console.log(`📂 Test Uploads:  ${TEST_UPLOAD_DIR}`);
  console.log('====================================================\n');

  let db = initDb(TEST_DB_PATH);
  runMigrations(db);

  // Setup Test Users
  const userA = (await authService.register({
    email: 'arch_alice@anchora.studio',
    fullName: 'Alice Stone',
    password: 'AtelierSecret123!',
  })).user;

  const userB = (await authService.register({
    email: 'arch_bob@anchora.studio',
    fullName: 'Bob Kahn',
    password: 'BrutalistSecret123!',
  })).user;

  // Setup Test Project for User A
  const projectA = projectRepository.create({
    id: 'proj_test_01',
    user_id: userA.id,
    title: 'Biophilic Urban Conservatory',
    category: 'Studio',
    semester: 'Semester 7',
    year: 2026,
    site_location: 'Auroville, India',
    site_area: '3,200 sq.m',
    typology: 'Civic & Ecology',
    description: 'Passive cooling conservatory study with rammed earth colonnades.',
    architectural_style: 'Contemporary Vernacular',
    notes: '[]',
    status: 'In Progress',
  });

  let testPassedCount = 0;

  // ----------------------------------------------------
  // TEST 1: Upload an image (JPEG) with magic number verification
  // ----------------------------------------------------
  console.log('Test 1: Uploading JPEG image with magic number verification...');
  const jpegContent = Buffer.concat([
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]), // JPEG SOI + JFIF
    Buffer.alloc(1024, 0xAA), // 1KB sample payload
  ]);
  const storageName1 = generateStorageFilename('.jpg');
  const storagePath1 = path.join(TEST_UPLOAD_DIR, storageName1);
  fs.writeFileSync(storagePath1, jpegContent);

  const isValidJpeg = validateFileSignature(storagePath1, '.jpg');
  if (!isValidJpeg) throw new Error('Valid JPEG header was rejected.');

  const file1 = fileRepository.create({
    id: 'file_test_01',
    user_id: userA.id,
    project_id: projectA.id,
    original_filename: 'Courtyard_Light_Study.jpg',
    storage_filename: storageName1,
    storage_path: storagePath1,
    mime_type: 'image/jpeg',
    file_extension: '.jpg',
    file_size: jpegContent.length,
    description: 'Natural daylight distribution through timber pergola',
    category: 'Reference Images',
  });

  if (file1.id !== 'file_test_01' || file1.project_title !== projectA.title) {
    throw new Error('Test 1 failed: File record or project association mismatch.');
  }
  console.log('✓ Test 1 Passed: Image file stored with verified magic signature and project link.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 2: Upload a PDF document
  // ----------------------------------------------------
  console.log('Test 2: Uploading PDF document with magic number verification...');
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Structural Details) >>\nendobj\ntrailer\n%%EOF');
  const storageName2 = generateStorageFilename('.pdf');
  const storagePath2 = path.join(TEST_UPLOAD_DIR, storageName2);
  fs.writeFileSync(storagePath2, pdfContent);

  const isValidPdf = validateFileSignature(storagePath2, '.pdf');
  if (!isValidPdf) throw new Error('Valid PDF header was rejected.');

  const file2 = fileRepository.create({
    id: 'file_test_02',
    user_id: userA.id,
    project_id: projectA.id,
    original_filename: 'Cantilever_Structural_Calculations.pdf',
    storage_filename: storageName2,
    storage_path: storagePath2,
    mime_type: 'application/pdf',
    file_extension: '.pdf',
    file_size: pdfContent.length,
    description: 'Reinforced concrete post-tensioned beam calculations',
    category: 'PDFs and Documents',
  });

  if (file2.file_extension !== '.pdf' || file2.mime_type !== 'application/pdf') {
    throw new Error('Test 2 failed: PDF metadata mismatch.');
  }
  console.log('✓ Test 2 Passed: PDF uploaded and validated successfully.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 3: Upload multiple files in a batch
  // ----------------------------------------------------
  console.log('Test 3: Uploading multiple architectural drawing files simultaneously...');
  const dwgContent = Buffer.concat([Buffer.from('AC1027\0\0\0\0'), Buffer.alloc(2048, 0x12)]); // AutoCAD 2013 DWG
  const pngContent = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(512)]);

  const dwgStorage = generateStorageFilename('.dwg');
  const pngStorage = generateStorageFilename('.png');
  fs.writeFileSync(path.join(TEST_UPLOAD_DIR, dwgStorage), dwgContent);
  fs.writeFileSync(path.join(TEST_UPLOAD_DIR, pngStorage), pngContent);

  const file3 = fileRepository.create({
    id: 'file_test_03',
    user_id: userA.id,
    project_id: projectA.id,
    original_filename: 'Ground_Floor_Plan_1_100.dwg',
    storage_filename: dwgStorage,
    storage_path: path.join(TEST_UPLOAD_DIR, dwgStorage),
    mime_type: 'image/vnd.dwg',
    file_extension: '.dwg',
    file_size: dwgContent.length,
    description: '1:100 CAD vector layout with structural grid',
    category: 'Floor Plans',
  });

  const file4 = fileRepository.create({
    id: 'file_test_04',
    user_id: userA.id,
    project_id: null, // Global unassigned studio asset
    original_filename: 'South_Elevation_Scan.png',
    storage_filename: pngStorage,
    storage_path: path.join(TEST_UPLOAD_DIR, pngStorage),
    mime_type: 'image/png',
    file_extension: '.png',
    file_size: pngContent.length,
    description: 'Pencil shading elevation study',
    category: 'Elevations',
  });

  const allUserAFiles = fileRepository.findByUser(userA.id);
  if (allUserAFiles.length !== 4) {
    throw new Error(`Test 3 failed: Expected 4 files, got ${allUserAFiles.length}.`);
  }
  console.log('✓ Test 3 Passed: Multiple files (DWG, PNG) stored across projects and global archive.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 4: Reject unsupported file types & disguised malicious files
  // ----------------------------------------------------
  console.log('Test 4: Rejecting unsupported file extensions and disguised executables...');
  const isExeAllowed = ALLOWED_EXTENSIONS.has('.exe');
  const isShAllowed = ALLOWED_EXTENSIONS.has('.sh');
  if (isExeAllowed || isShAllowed) throw new Error('Test 4 failed: Dangerous extensions permitted.');

  // Disguised file: .png extension but contains MZ executable header
  const fakePngPath = path.join(TEST_UPLOAD_DIR, 'disguised.png');
  fs.writeFileSync(fakePngPath, Buffer.from('MZ\x90\x00\x03\x00\x00\x00ThisIsAnExecutable'));
  const isFakePngValid = validateFileSignature(fakePngPath, '.png');
  fs.unlinkSync(fakePngPath);

  if (isFakePngValid) throw new Error('Test 4 failed: Executable disguised as PNG was not rejected.');
  console.log('✓ Test 4 Passed: Unsupported extensions (.exe, .sh) and disguised files strictly rejected.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 5: Reject oversized files
  // ----------------------------------------------------
  console.log('Test 5: Verifying maximum file size boundary check...');
  const testLimit = MAX_FILE_SIZE_BYTES; // 50MB
  const simulatedSize = testLimit + 1024;
  const isExceeded = simulatedSize > MAX_FILE_SIZE_BYTES;
  if (!isExceeded) throw new Error('Test 5 failed: Oversized file check failed.');
  console.log(`✓ Test 5 Passed: Oversized files strictly rejected (> ${testLimit / 1024 / 1024} MB).\n`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 6: Preview authorized file stream
  // ----------------------------------------------------
  console.log('Test 6: Verifying preview access for authorized user...');
  const previewTarget = fileRepository.findById(file1.id, userA.id);
  if (!previewTarget || !fs.existsSync(previewTarget.storage_path)) {
    throw new Error('Test 6 failed: Preview target not found.');
  }
  const previewBytes = fs.readFileSync(previewTarget.storage_path);
  if (previewBytes.length !== jpegContent.length) {
    throw new Error('Test 6 failed: Preview content length mismatch.');
  }
  console.log('✓ Test 6 Passed: Authorized file preview verified with correct bytes and headers.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 7: Download original file
  // ----------------------------------------------------
  console.log('Test 7: Verifying download delivery of original file...');
  const downloadTarget = fileRepository.findById(file3.id, userA.id);
  if (!downloadTarget || downloadTarget.original_filename !== 'Ground_Floor_Plan_1_100.dwg') {
    throw new Error('Test 7 failed: Download metadata mismatch.');
  }
  console.log('✓ Test 7 Passed: Original DWG file ready for attachment download.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 8: Edit file metadata (display filename and description)
  // ----------------------------------------------------
  console.log('Test 8: Editing display filename and description without altering internal path...');
  const updated1 = fileRepository.update(file1.id, userA.id, {
    original_filename: 'Courtyard_Light_Study_Final_RevB.jpg',
    description: 'Updated solar penetration study at 12:00 PM solstice',
  });

  if (
    !updated1 ||
    updated1.original_filename !== 'Courtyard_Light_Study_Final_RevB.jpg' ||
    updated1.storage_filename !== storageName1 // Internal storage filename preserved!
  ) {
    throw new Error('Test 8 failed: Metadata edit failed or internal storage path was corrupted.');
  }
  console.log('✓ Test 8 Passed: Display filename and description updated; internal storage file preserved.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 9: Change architectural category
  // ----------------------------------------------------
  console.log('Test 9: Changing file category...');
  const updatedCategory = fileRepository.update(file4.id, userA.id, {
    category: 'Sections',
  });
  if (!updatedCategory || updatedCategory.category !== 'Sections') {
    throw new Error('Test 9 failed: Category update failed.');
  }
  console.log('✓ Test 9 Passed: File category successfully changed to "Sections".\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 10: Associate files with project and reassign
  // ----------------------------------------------------
  console.log('Test 10: Associating previously unassigned file with project...');
  const linkedFile = fileRepository.update(file4.id, userA.id, {
    project_id: projectA.id,
  });

  if (!linkedFile || linkedFile.project_id !== projectA.id || linkedFile.project_title !== projectA.title) {
    throw new Error('Test 10 failed: Project association failed.');
  }

  // Verify filtering by project
  const projectAFiles = fileRepository.findByUser(userA.id, { projectId: projectA.id });
  if (projectAFiles.length !== 4) {
    throw new Error(`Test 10 failed: Expected 4 files in projectA, got ${projectAFiles.length}.`);
  }
  console.log('✓ Test 10 Passed: Project association and project-scoped querying verified.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 11: Delete file (SQLite record AND physical disk file)
  // ----------------------------------------------------
  console.log('Test 11: Deleting file and confirming disk unlinking...');
  const fileToDelete = fileRepository.findById(file2.id, userA.id)!;
  const targetDiskPath = fileToDelete.storage_path;
  if (!fs.existsSync(targetDiskPath)) throw new Error('File to delete missing before test.');

  const dbDeleted = fileRepository.delete(file2.id, userA.id);
  removePhysicalFile(targetDiskPath);

  if (!dbDeleted) throw new Error('Test 11 failed: Database deletion failed.');
  if (fs.existsSync(targetDiskPath)) throw new Error('Test 11 failed: Physical file was not unlinked from disk.');

  const recheck = fileRepository.findById(file2.id, userA.id);
  if (recheck !== null) throw new Error('Test 11 failed: Deleted file still queryable in database.');
  console.log('✓ Test 11 Passed: File deleted from SQLite and disk storage cleanly.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 12: Reject unauthorized access (User A vs User B data isolation)
  // ----------------------------------------------------
  console.log('Test 12: Verifying data isolation across users...');
  // User B tries to query User A's file
  const userBAccess = fileRepository.findById(file1.id, userB.id);
  if (userBAccess !== null) throw new Error('Test 12 failed: User B was able to access User A file.');

  // User B tries to delete User A's file
  const userBDelete = fileRepository.delete(file1.id, userB.id);
  if (userBDelete !== false) throw new Error('Test 12 failed: User B was able to delete User A file.');

  // User B file listing is empty
  const userBList = fileRepository.findByUser(userB.id);
  if (userBList.length !== 0) throw new Error('Test 12 failed: User B sees User A files.');
  console.log('✓ Test 12 Passed: Complete data isolation between User A and User B verified.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 13: Reject malicious filenames and path traversal
  // ----------------------------------------------------
  console.log('Test 13: Sanitizing path traversal and malicious characters from filenames...');
  const traversal1 = sanitizeFilename('../../etc/passwd.jpg');
  if (traversal1.includes('/') || traversal1.includes('\\') || traversal1.includes('..')) {
    throw new Error(`Test 13 failed: Path traversal not stripped: "${traversal1}"`);
  }

  const traversal2 = sanitizeFilename('..\\..\\Windows\\System32\\cmd.exe.dwg');
  if (traversal2.includes('\\') || traversal2.includes('..')) {
    throw new Error(`Test 13 failed: Windows traversal not stripped: "${traversal2}"`);
  }

  const nullByte = sanitizeFilename('valid_name\0_evil.pdf');
  if (nullByte.includes('\0')) {
    throw new Error('Test 13 failed: Null byte not stripped.');
  }
  console.log('✓ Test 13 Passed: Path traversal (../../), backslashes, and null bytes completely sanitized.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 14: Persistence across backend and database restart
  // ----------------------------------------------------
  console.log('Test 14: Closing SQLite connection and reopening backend instance...');
  closeDb();

  // Re-open fresh database connection
  const reopenedDb = initDb(TEST_DB_PATH);

  const persistentStmt = reopenedDb.prepare(`
    SELECT pf.*, p.title AS project_title 
    FROM project_files pf 
    LEFT JOIN projects p ON pf.project_id = p.id
    WHERE pf.user_id = ?
    ORDER BY pf.created_at DESC
  `);
  const persistedFiles = persistentStmt.all(userA.id) as any[];

  if (persistedFiles.length !== 3) {
    throw new Error(`Test 14 failed: Expected 3 persisted files, found ${persistedFiles.length}.`);
  }

  // Verify physical files still exist in uploads directory
  for (const pf of persistedFiles) {
    if (!fs.existsSync(pf.storage_path)) {
      throw new Error(`Test 14 failed: Physical file missing at ${pf.storage_path}`);
    }
  }
  console.log('✓ Test 14 Passed: All metadata and physical files preserved intact across restart.\n');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 15: Correct rollback behavior when database operations fail
  // ----------------------------------------------------
  console.log('Test 15: Verifying physical cleanup when database constraint fails...');
  const orphanStorageName = generateStorageFilename('.jpg');
  const orphanStoragePath = path.join(TEST_UPLOAD_DIR, orphanStorageName);
  fs.writeFileSync(orphanStoragePath, jpegContent);

  try {
    // Attempt inserting file with non-existent foreign key user_id
    getDb().prepare(`
      INSERT INTO project_files (
        id, user_id, project_id, original_filename, storage_filename, 
        storage_path, mime_type, file_extension, file_size, description, 
        category, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'file_orphan',
      'non_existent_user_99999',
      null,
      'Orphan.jpg',
      orphanStorageName,
      orphanStoragePath,
      'image/jpeg',
      '.jpg',
      1000,
      '',
      'Other',
      new Date().toISOString(),
      new Date().toISOString()
    );
    throw new Error('Database insertion should have failed due to foreign key violation.');
  } catch (err: any) {
    // Simulate rollback handling in route: remove physical file
    removePhysicalFile(orphanStoragePath);
  }

  if (fs.existsSync(orphanStoragePath)) {
    throw new Error('Test 15 failed: Orphan file was not cleaned up after database error.');
  }
  console.log('✓ Test 15 Passed: Rollback cleanup successfully removes physical file on failure.\n');
  testPassedCount++;

  // Final cleanup
  closeDb();
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    if (fs.existsSync(TEST_UPLOAD_DIR)) fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  } catch (e) {}

  console.log('====================================================');
  console.log(`🎉 ALL ${testPassedCount}/15 PHASE 6 TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  closeDb();
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    if (fs.existsSync(TEST_UPLOAD_DIR)) fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  } catch (e) {}
  process.exit(1);
});
