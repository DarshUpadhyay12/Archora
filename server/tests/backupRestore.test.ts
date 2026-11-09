import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import { initDb, closeDb, getDb, getDatabasePath } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { authService } from '../services/authService';
import { projectRepository } from '../repositories/projectRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { getUploadDirectory } from '../services/fileStorageService';
import { backupService, getBackupDirectory } from '../services/backupService';
import { backupRepository } from '../repositories/backupRepository';
import { settingsRepository } from '../repositories/settingsRepository';

// Configure isolated test environment
const TEST_ROOT = path.resolve('test_archora_phase9_env');
const TEST_DB_PATH = path.join(TEST_ROOT, 'data', 'archora.db');
const TEST_BACKUP_DIR = path.join(TEST_ROOT, 'backups');
const TEST_UPLOAD_DIR = path.join(TEST_ROOT, 'uploads');

process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.BACKUP_DIR = TEST_BACKUP_DIR;
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

// Cleanup helper
function cleanupTestEnv() {
  try {
    closeDb();
    if (fs.existsSync(TEST_ROOT)) {
      fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    }
  } catch (e) {}
}

async function runBackupRestoreTestSuite() {
  console.log('====================================================');
  console.log('🛡️ ARCHORA PHASE 9: LOCAL BACKUP & RESTORE TEST SUITE');
  console.log(`📁 Test Environment: ${TEST_ROOT}`);
  console.log('====================================================\n');

  cleanupTestEnv();
  fs.mkdirSync(path.join(TEST_ROOT, 'data'), { recursive: true });
  fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
  fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });

  const db = initDb(TEST_DB_PATH);
  runMigrations(db);

  let testPassedCount = 0;

  // Setup initial test data
  console.log('Setting up studio user, architectural project, and drawing file...');
  const registered = await authService.register({
    email: 'bawa@archora.studio',
    fullName: 'Geoffrey Bawa',
    password: 'LunugangaEstate123!',
  });
  const user = registered.user;

  const project1 = projectRepository.create({
    id: 'proj_bawa_01',
    user_id: user.id,
    title: 'Kandalama Hotel',
    typology: 'Hospitality',
    description: 'Minimalist cliffside resort integrated with natural rock face in Dambulla.',
    architectural_style: 'Tropical Modernism',
    semester: 'Thesis Studio',
  });

  const convo1 = conversationRepository.createConversation({
    id: 'conv_bawa_01',
    user_id: user.id,
    module: 'tutor',
    title: 'Biophilic Rock Integration Consultation',
    project_id: project1.id,
  });

  // Create an actual uploaded drawing file on disk
  const sampleDrawingPath = path.join(TEST_UPLOAD_DIR, 'test_bawa_section.png');
  const sampleDrawingContent = Buffer.from('ARCHORA_TEST_PNG_BINARY_CONTENT_' + Date.now(), 'utf8');
  fs.writeFileSync(sampleDrawingPath, sampleDrawingContent);

  // Link file record in database
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO project_files (
      id, user_id, project_id, original_filename, storage_filename, storage_path,
      mime_type, file_extension, file_size, description, category, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'file_bawa_01',
    user.id,
    project1.id,
    'bawa_section.png',
    'test_bawa_section.png',
    sampleDrawingPath,
    'image/png',
    '.png',
    sampleDrawingContent.length,
    'Hand-drawn section sketch',
    'Drawing',
    nowIso,
    nowIso
  );

  console.log('✓ Initial environment prepared with 1 user, 1 project, 1 conversation, 1 drawing.\n');

  // ----------------------------------------------------
  // TEST 1: Create Real Backup Archive (.zip)
  // ----------------------------------------------------
  console.log('Test 1: Creating real atomic backup archive (.zip)...');
  const backupResult = await backupService.createBackup({
    userId: user.id,
    isAutomatic: false,
    destinationDir: TEST_BACKUP_DIR,
    customFilename: 'Archora-Backup-Test-Baseline.zip',
  });

  if (!fs.existsSync(backupResult.filePath)) {
    throw new Error('Test 1 Failed: Backup ZIP file was not created on disk.');
  }
  const zipStat = fs.statSync(backupResult.filePath);
  if (zipStat.size === 0) {
    throw new Error('Test 1 Failed: Created backup ZIP file is 0 bytes.');
  }

  const dbBackupRecord = backupRepository.findByFilename('Archora-Backup-Test-Baseline.zip');
  if (!dbBackupRecord || !dbBackupRecord.checksum_sha256) {
    throw new Error('Test 1 Failed: Backup record not saved or verified in database.');
  }

  testPassedCount++;
  console.log(`✓ Test 1 Passed: Real backup archive created successfully (${zipStat.size} bytes).\n`);

  // ----------------------------------------------------
  // TEST 2: Verify Archive Integrity and manifest.json
  // ----------------------------------------------------
  console.log('Test 2: Verifying archive integrity and manifest structure...');
  const verifyResult = await backupService.verifyBackup(backupResult.filePath);
  if (!verifyResult.valid) {
    throw new Error(`Test 2 Failed: Valid archive failed verification: ${verifyResult.errors.join('; ')}`);
  }
  if (!verifyResult.manifest) {
    throw new Error('Test 2 Failed: Manifest missing in verification result.');
  }
  if (verifyResult.manifest.backupVersion !== '1.0.0') {
    throw new Error(`Test 2 Failed: Unexpected backup version "${verifyResult.manifest.backupVersion}".`);
  }
  if (verifyResult.manifest.databaseName !== 'archora.db') {
    throw new Error('Test 2 Failed: Manifest does not specify archora.db.');
  }
  if (!verifyResult.manifest.checksums['database/archora.db']) {
    throw new Error('Test 2 Failed: Manifest missing database SHA-256 checksum.');
  }

  testPassedCount++;
  console.log('✓ Test 2 Passed: Archive integrity and manifest verified with SHA-256 checksums.\n');

  // ----------------------------------------------------
  // TEST 3: Verify Database Contents in the Backup Snapshot
  // ----------------------------------------------------
  console.log('Test 3: Inspecting database snapshot inside ZIP archive...');
  const baselineZip = new AdmZip(backupResult.filePath);
  const dbEntry = baselineZip.getEntry('database/archora.db');
  if (!dbEntry) {
    throw new Error('Test 3 Failed: database/archora.db not present in ZIP archive.');
  }

  // Extract snapshot to a temporary verification folder
  const tempVerifyDb = path.join(TEST_ROOT, 'temp_verify.db');
  fs.writeFileSync(tempVerifyDb, dbEntry.getData());

  const inspectDb = new Database(tempVerifyDb);
  const usersInBackup = inspectDb.prepare('SELECT * FROM users WHERE email = ?').get('bawa@archora.studio') as any;
  const projectsInBackup = inspectDb.prepare('SELECT * FROM projects WHERE id = ?').get(project1.id) as any;
  const sessionsInBackup = inspectDb.prepare('SELECT COUNT(*) as c FROM sessions').get() as any;

  inspectDb.close();
  fs.unlinkSync(tempVerifyDb);

  if (!usersInBackup || usersInBackup.full_name !== 'Geoffrey Bawa') {
    throw new Error('Test 3 Failed: User Geoffrey Bawa not found in backup database.');
  }
  if (!projectsInBackup || projectsInBackup.title !== 'Kandalama Hotel') {
    throw new Error('Test 3 Failed: Project Kandalama Hotel not found in backup database.');
  }
  if (sessionsInBackup.c !== 0) {
    throw new Error('Test 3 Failed: Active sessions were not sanitized from backup.');
  }

  testPassedCount++;
  console.log('✓ Test 3 Passed: Database snapshot contains authentic records with sanitized sessions.\n');

  // ----------------------------------------------------
  // TEST 4: Verify Uploaded Architectural Files in Archive
  // ----------------------------------------------------
  console.log('Test 4: Verifying uploaded drawing preservation in archive...');
  const uploadedEntry = baselineZip.getEntry('uploads/test_bawa_section.png');
  if (!uploadedEntry) {
    throw new Error('Test 4 Failed: uploads/test_bawa_section.png not preserved in ZIP archive.');
  }

  const extractedDrawingHash = crypto.createHash('sha256').update(uploadedEntry.getData()).digest('hex');
  const originalDrawingHash = crypto.createHash('sha256').update(sampleDrawingContent).digest('hex');
  if (extractedDrawingHash !== originalDrawingHash) {
    throw new Error('Test 4 Failed: Extracted drawing hash does not match original drawing file.');
  }

  testPassedCount++;
  console.log('✓ Test 4 Passed: Uploaded architectural drawings preserved byte-for-byte in archive.\n');

  // ----------------------------------------------------
  // TEST 5: Restore a Valid Backup into Active Workspace
  // ----------------------------------------------------
  console.log('Test 5: Restoring valid backup after workspace mutation...');
  // Mutate workspace: add a temporary project and modify user's name
  getDb().prepare("UPDATE users SET full_name = 'Modified User Name' WHERE email = ?").run('bawa@archora.studio');
  projectRepository.create({
    id: 'proj_temp_02',
    user_id: user.id,
    title: 'Ephemeral Temporary Structure',
    typology: 'Pavilion',
    description: 'Will be discarded upon restoration.',
    semester: 'Year 1',
  });

  const checkMutated = getDb().prepare("SELECT full_name FROM users WHERE email = ?").get('bawa@archora.studio') as any;
  if (checkMutated.full_name !== 'Modified User Name') {
    throw new Error('Test 5 Setup Failed: Workspace mutation not applied.');
  }

  // Perform restoration
  const restoreResult = await backupService.restoreBackup(backupResult.filePath);
  if (!restoreResult.success) {
    throw new Error('Test 5 Failed: restoreBackup reported failure.');
  }

  // Verify that active database reverted to Geoffrey Bawa and Ephemeral project is gone
  const restoredDb = getDb();
  const restoredUser = restoredDb.prepare("SELECT full_name FROM users WHERE email = ?").get('bawa@archora.studio') as any;
  const ephemeralProject = restoredDb.prepare("SELECT * FROM projects WHERE title = 'Ephemeral Temporary Structure'").get();

  if (!restoredUser || restoredUser.full_name !== 'Geoffrey Bawa') {
    throw new Error(`Test 5 Failed: Active database user not restored: ${restoredUser?.full_name}`);
  }
  if (ephemeralProject) {
    throw new Error('Test 5 Failed: Ephemeral project still present after restoration.');
  }

  testPassedCount++;
  console.log('✓ Test 5 Passed: Valid backup restored cleanly into active workspace.\n');

  // ----------------------------------------------------
  // TEST 6: Restore into Empty / Missing Data Directory
  // ----------------------------------------------------
  console.log('Test 6: Restoring into a fresh, non-existent database path...');
  const FRESH_DB_PATH = path.join(TEST_ROOT, 'fresh_subfolder', 'new_archora.db');
  process.env.DATABASE_PATH = FRESH_DB_PATH;

  // Close current db so connection points to new path
  closeDb();
  initDb(FRESH_DB_PATH);
  runMigrations(getDb());

  const restoreFreshResult = await backupService.restoreBackup(backupResult.filePath);
  if (!restoreFreshResult.success) {
    throw new Error('Test 6 Failed: Restoration into fresh path failed.');
  }

  const freshDb = getDb();
  const freshUser = freshDb.prepare("SELECT full_name FROM users WHERE email = ?").get('bawa@archora.studio') as any;
  if (!freshUser || freshUser.full_name !== 'Geoffrey Bawa') {
    throw new Error('Test 6 Failed: Restored user missing in fresh database path.');
  }

  // Restore environment variable to original test path
  process.env.DATABASE_PATH = TEST_DB_PATH;
  closeDb();
  initDb(TEST_DB_PATH);

  testPassedCount++;
  console.log('✓ Test 6 Passed: Restored successfully into newly created directory hierarchy.\n');

  // ----------------------------------------------------
  // TEST 7: Reject Corrupted Archives
  // ----------------------------------------------------
  console.log('Test 7: Rejecting corrupted archives...');
  const corruptedBuffer = Buffer.from('NOT_A_VALID_ZIP_ARCHIVE_HEADER_CORRUPTED_BYTES');
  const verifyCorrupted = await backupService.verifyBackup(corruptedBuffer);
  if (verifyCorrupted.valid) {
    throw new Error('Test 7 Failed: Corrupted archive was incorrectly accepted as valid.');
  }

  let restoreThrew = false;
  try {
    await backupService.restoreBackup(corruptedBuffer);
  } catch (e: any) {
    restoreThrew = true;
  }
  if (!restoreThrew) {
    throw new Error('Test 7 Failed: Corrupted archive did not throw error on restoration attempt.');
  }

  testPassedCount++;
  console.log('✓ Test 7 Passed: Corrupted archives rejected safely without altering state.\n');

  // ----------------------------------------------------
  // TEST 8: Reject Malicious Archive Paths (Zip Slip Protection)
  // ----------------------------------------------------
  console.log('Test 8: Detecting and blocking Zip Slip path traversal...');
  const maliciousZip = new AdmZip();
  maliciousZip.addFile('exploit.txt', Buffer.from('EXPLOIT_PAYLOAD'));
  maliciousZip.getEntries()[0].entryName = '../../Windows/System32/malicious.dll';
  maliciousZip.addFile('manifest.json', Buffer.from(JSON.stringify({ backupVersion: '1.0.0' })));
  const maliciousZipBuffer = maliciousZip.toBuffer();

  const verifyMalicious = await backupService.verifyBackup(maliciousZipBuffer);
  if (verifyMalicious.valid) {
    throw new Error('Test 8 Failed: Malicious Zip Slip archive was accepted as valid.');
  }
  const hasZipSlipError = verifyMalicious.errors.some((err) =>
    err.toLowerCase().includes('zip slip') || err.toLowerCase().includes('unsafe entry path')
  );
  if (!hasZipSlipError) {
    throw new Error('Test 8 Failed: Verification error did not specifically identify Zip Slip attempt.');
  }

  let maliciousRestoreThrew = false;
  try {
    await backupService.restoreBackup(maliciousZipBuffer);
  } catch (e) {
    maliciousRestoreThrew = true;
  }
  if (!maliciousRestoreThrew) {
    throw new Error('Test 8 Failed: Malicious Zip Slip restore was not blocked.');
  }

  testPassedCount++;
  console.log('✓ Test 8 Passed: Zip Slip path traversal attempt blocked by security gate.\n');

  // ----------------------------------------------------
  // TEST 9: Handle Incompatible Backup Versions
  // ----------------------------------------------------
  console.log('Test 9: Handling incompatible backup versions...');
  const incompatibleZip = new AdmZip();
  incompatibleZip.addFile('manifest.json', Buffer.from(JSON.stringify({
    backupVersion: '99.0.0',
    appVersion: '99.0.0',
    databaseName: 'archora.db',
  })));
  incompatibleZip.addFile('database/archora.db', Buffer.from('SQLITE_PLACEHOLDER'));

  const verifyIncompatible = await backupService.verifyBackup(incompatibleZip.toBuffer());
  if (verifyIncompatible.valid) {
    throw new Error('Test 9 Failed: Incompatible version 99.0.0 was accepted.');
  }
  const hasVersionError = verifyIncompatible.errors.some((err) =>
    err.toLowerCase().includes('incompatible backup version')
  );
  if (!hasVersionError) {
    throw new Error('Test 9 Failed: Incompatible version error not returned.');
  }

  testPassedCount++;
  console.log('✓ Test 9 Passed: Incompatible backup version rejected cleanly.\n');

  // ----------------------------------------------------
  // TEST 10: Handle Interrupted / Missing File Paths Cleanly
  // ----------------------------------------------------
  console.log('Test 10: Handling missing file operations cleanly...');
  const missingPath = path.join(TEST_BACKUP_DIR, 'NonExistentBackup.zip');
  const verifyMissing = await backupService.verifyBackup(missingPath);
  if (verifyMissing.valid || !verifyMissing.errors.some(e => e.includes('not found') || e.includes('does not exist'))) {
    throw new Error('Test 10 Failed: Missing file did not return expected non-existent error.');
  }

  testPassedCount++;
  console.log('✓ Test 10 Passed: Missing file path handled cleanly with appropriate error.\n');

  // ----------------------------------------------------
  // TEST 11 & 12: Pre-Restore Safety Snapshot & Safe Rollback on Failure
  // ----------------------------------------------------
  console.log('Test 11 & 12: Testing pre-restore safety snapshot and automatic rollback on failure...');
  // Ensure current DB has distinct identifiable state
  getDb().prepare("UPDATE users SET bio = 'Pre-Restore Safety Check' WHERE email = ?").run('bawa@archora.studio');

  // Construct a ZIP that passes basic manifest check but contains a corrupt SQLite database
  const corruptDbZip = new AdmZip();
  const corruptDbManifest = {
    backupVersion: '1.0.0',
    appVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    databaseSchemaVersion: 7,
    databaseName: 'archora.db',
    includedCategories: ['database'],
    fileCount: 1,
    totalSizeBytes: 30,
    checksums: {
      'database/archora.db': crypto.createHash('sha256').update('NOT_A_VALID_SQLITE_DATABASE').digest('hex'),
    },
    metadata: {
      userCount: 1,
      projectCount: 1,
      filesCount: 0,
      conversationCount: 0,
      savedOutputCount: 0,
      pdfExportCount: 0,
      os: 'test',
      nodeVersion: process.version,
    },
  };
  corruptDbZip.addFile('manifest.json', Buffer.from(JSON.stringify(corruptDbManifest)));
  corruptDbZip.addFile('database/archora.db', Buffer.from('NOT_A_VALID_SQLITE_DATABASE'));

  let rollbackTriggered = false;
  try {
    await backupService.restoreBackup(corruptDbZip.toBuffer());
  } catch (err: any) {
    rollbackTriggered = true;
    if (!err.message.includes('rolled back')) {
      throw new Error(`Test 11 Failed: Error did not confirm rollback was executed: ${err.message}`);
    }
  }

  if (!rollbackTriggered) {
    throw new Error('Test 11 Failed: Restore with invalid SQLite DB did not throw.');
  }

  // Check that current state was restored by rollback
  const dbAfterRollback = getDb();
  const userAfterRollback = dbAfterRollback.prepare("SELECT bio FROM users WHERE email = ?").get('bawa@archora.studio') as any;
  if (!userAfterRollback || userAfterRollback.bio !== 'Pre-Restore Safety Check') {
    throw new Error('Test 12 Failed: Database was not rolled back to prior safety snapshot state.');
  }

  testPassedCount += 2;
  console.log('✓ Tests 11 & 12 Passed: Pre-restore safety snapshot created and atomic rollback succeeded.\n');

  // ----------------------------------------------------
  // TEST 13: Delete a Backup Safely from Disk and Database
  // ----------------------------------------------------
  console.log('Test 13: Safely deleting a backup from disk and registry...');
  // Create a backup specifically to delete
  const bkpToDelete = await backupService.createBackup({
    userId: user.id,
    customFilename: 'Archora-Backup-To-Delete.zip',
  });

  if (!fs.existsSync(bkpToDelete.filePath)) {
    throw new Error('Test 13 Setup Failed: Temp backup not created.');
  }

  const deleteSuccess = await backupService.deleteBackup('Archora-Backup-To-Delete.zip');
  if (!deleteSuccess) {
    throw new Error('Test 13 Failed: deleteBackup returned false.');
  }

  if (fs.existsSync(bkpToDelete.filePath)) {
    throw new Error('Test 13 Failed: Backup file still exists on disk after deletion.');
  }

  const recordAfterDelete = backupRepository.findByFilename('Archora-Backup-To-Delete.zip');
  if (recordAfterDelete) {
    throw new Error('Test 13 Failed: Backup record still exists in SQLite database.');
  }

  testPassedCount++;
  console.log('✓ Test 13 Passed: Backup file and database record deleted safely.\n');

  // ----------------------------------------------------
  // TEST 14: Relational Integrity of Restored Projects & Conversations
  // ----------------------------------------------------
  console.log('Test 14: Validating relational integrity of restored projects and conversations...');
  // Restore the baseline backup again
  await backupService.restoreBackup(backupResult.filePath);

  const verifiedDb = getDb();
  const restoredProjects = projectRepository.findAll(user.id);
  if (restoredProjects.length === 0 || restoredProjects[0].title !== 'Kandalama Hotel') {
    throw new Error('Test 14 Failed: Restored project not found via projectRepository.');
  }

  const restoredConvos = conversationRepository.findConversationsByUser(user.id);
  if (restoredConvos.length === 0 || restoredConvos[0].title !== 'Biophilic Rock Integration Consultation') {
    throw new Error('Test 14 Failed: Restored conversation not found via conversationRepository.');
  }
  if (restoredConvos[0].project_id !== restoredProjects[0].id) {
    throw new Error('Test 14 Failed: Foreign key relationship between project and conversation broken.');
  }

  testPassedCount++;
  console.log('✓ Test 14 Passed: Relational schema and foreign keys verified intact.\n');

  // ----------------------------------------------------
  // TEST 15: Restored Drawing Files Accessible on Disk
  // ----------------------------------------------------
  console.log('Test 15: Validating restored drawing files on disk...');
  const restoredDrawingPath = path.join(TEST_UPLOAD_DIR, 'test_bawa_section.png');
  if (!fs.existsSync(restoredDrawingPath)) {
    throw new Error('Test 15 Failed: Restored drawing file not found in uploads directory.');
  }

  const restoredContent = fs.readFileSync(restoredDrawingPath);
  if (!restoredContent.equals(sampleDrawingContent)) {
    throw new Error('Test 15 Failed: Restored drawing content does not match original bytes.');
  }

  testPassedCount++;
  console.log('✓ Test 15 Passed: Restored drawings are accessible on disk with bit-for-bit fidelity.\n');

  // Final summary
  console.log('====================================================');
  console.log(`🎉 ALL ${testPassedCount} ARCHORA PHASE 9 TESTS PASSED WITHOUT ERRORS!`);
  console.log('====================================================\n');

  cleanupTestEnv();
}

runBackupRestoreTestSuite().catch((err) => {
  console.error('\n❌ PHASE 9 TEST SUITE FAILED:', err);
  cleanupTestEnv();
  process.exit(1);
});
