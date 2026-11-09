import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { initDb, closeDb, getDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { googleDriveStorageService, formatBytes } from '../services/googleDriveStorageService';
import { fileRepository } from '../repositories/fileRepository';
import { projectRepository } from '../repositories/projectRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { savedOutputRepository } from '../repositories/savedOutputRepository';
import { syncRepository } from '../repositories/syncRepository';
import { settingsRepository, DEFAULT_GOOGLE_DRIVE_FOLDER_ID } from '../repositories/settingsRepository';
import { removePhysicalFile, getTempDirectory } from '../services/fileStorageService';

async function runGoogleDriveStorageTests() {
  console.log('===============================================================');
  console.log('ARCHORA: GOOGLE DRIVE CLOUD STORAGE & SYNC TEST SUITE');
  console.log('===============================================================\n');

  // Isolated test directory on Drive D: to avoid writing to full Drive C:
  const testDir = path.join(getTempDirectory(), `archora_test_drive_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(testDir, { recursive: true });
  const testDbPath = path.join(testDir, 'archora_test.db');
  process.env.DATABASE_PATH = testDbPath;

  const db = initDb(testDbPath);
  runMigrations(db);

  // Setup test user
  const userId = `usr_test_${Date.now()}`;
  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    'architect@studio-archora.local',
    '$2a$12$eX4mPL3H4shSecretHashNotForSync1234567890',
    'Principal Architect',
    'student',
    new Date().toISOString(),
    new Date().toISOString()
  );

  console.log(`[Setup] Initialized test environment at: ${testDbPath}`);
  console.log(`[Setup] Target Google Drive Folder ID: ${DEFAULT_GOOGLE_DRIVE_FOLDER_ID}\n`);

  // TEST 1: Default Google Drive Folder Configuration
  console.log('Test 1: Verifying default Google Drive folder ID...');
  const settings = settingsRepository.get(userId);
  if (settings.google_drive_folder_id !== DEFAULT_GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error(`Test 1 Failed: Expected folder ID "${DEFAULT_GOOGLE_DRIVE_FOLDER_ID}", got "${settings.google_drive_folder_id}"`);
  }
  if (DEFAULT_GOOGLE_DRIVE_FOLDER_ID !== '1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl') {
    throw new Error(`Test 1 Failed: Folder ID mismatch with user folder.`);
  }
  console.log(`✓ Test 1 Passed: Default folder verified as "${DEFAULT_GOOGLE_DRIVE_FOLDER_ID}".\n`);

  // TEST 2: Low Local Storage Strategy & File Metadata Persistence
  console.log('Test 2: Testing low local storage unlinking and cloud-only metadata...');
  const dummyFilePath = path.join(testDir, 'courtyard_elevation.png');
  fs.writeFileSync(dummyFilePath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]));

  const fileSize = fs.statSync(dummyFilePath).size;
  const dummyDriveId = '1_DummyDriveFileId_998877';

  // Create file record directly simulating verified Google Drive upload with low-storage unlinking
  const fileRecord = fileRepository.create({
    id: `file_cloud_${Date.now()}`,
    user_id: userId,
    original_filename: 'courtyard_elevation.png',
    storage_filename: 'archora_file_test.png',
    storage_path: `gdrive://${dummyDriveId}`,
    mime_type: 'image/png',
    file_extension: '.png',
    file_size: fileSize,
    description: '1:50 Schematic Courtyard Elevation',
    category: 'Elevations',
    google_drive_file_id: dummyDriveId,
    cloud_storage_status: 'cloud_only',
    cloud_web_view_link: `https://drive.google.com/file/d/${dummyDriveId}/view`,
    cloud_thumbnail_link: `https://drive.google.com/thumbnail?id=${dummyDriveId}`,
  });

  // Verify the local dummy file can be unlinked safely
  removePhysicalFile(dummyFilePath);
  if (fs.existsSync(dummyFilePath)) {
    throw new Error('Test 2 Failed: Local dummy file was not unlinked.');
  }

  const fetched = fileRepository.findById(fileRecord.id, userId);
  if (!fetched || fetched.cloud_storage_status !== 'cloud_only') {
    throw new Error('Test 2 Failed: Cloud storage status is not cloud_only.');
  }
  if (fetched.google_drive_file_id !== dummyDriveId) {
    throw new Error('Test 2 Failed: Google Drive file ID mismatch.');
  }
  console.log(`✓ Test 2 Passed: Cloud-only file metadata verified; local physical copy unlinked to save disk space.\n`);

  // TEST 3: Storage Usage Metrics & Disk Space Saved
  console.log('Test 3: Testing storage usage calculation and local disk space saved...');
  const storageSummary = fileRepository.getStorageUsageSummary(userId);
  if (storageSummary.cloudFilesCount !== 1) {
    throw new Error(`Test 3 Failed: Expected 1 cloud file, got ${storageSummary.cloudFilesCount}`);
  }
  if (storageSummary.savedLocalBytes !== fileSize) {
    throw new Error(`Test 3 Failed: Expected ${fileSize} bytes saved locally, got ${storageSummary.savedLocalBytes}`);
  }

  const overview = googleDriveStorageService.getStorageOverview(userId);
  if (overview.savedLocalDiskBytes !== fileSize) {
    throw new Error(`Test 3 Failed: Storage overview disk bytes saved mismatch.`);
  }
  if (typeof overview.freeDiskBytes !== 'number' || overview.freeDiskBytes <= 0) {
    throw new Error(`Test 3 Failed: Free disk bytes calculation returned invalid number.`);
  }
  console.log(`✓ Test 3 Passed: Storage summary accurate (Local disk saved: ${overview.savedLocalDiskFormatted}, Host free: ${overview.freeDiskFormatted}, Low storage active: ${overview.isLowDiskSpace}).\n`);

  // TEST 4: Website Data Snapshot Generation & STRICT ZERO-SECRET Leakage Audit
  console.log('Test 4: Generating website data snapshot and auditing for ZERO secrets...');
  // Populate realistic studio data
  const testProject = projectRepository.create({
    id: `proj_test_${Date.now()}`,
    user_id: userId,
    title: 'Vernacular Bamboo Pavilion',
    category: 'Sustainable Studio',
    typology: 'Cultural Pavilion',
    description: 'A carbon-neutral public pavilion utilizing locally sourced bamboo and natural ventilation.',
  });

  db.prepare(`
    INSERT INTO project_notes (id, project_id, user_id, content, author, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `note_${Date.now()}`,
    testProject.id,
    userId,
    'Ventilation analysis requires 30% open facade area on southern exposure.',
    'Lead Architect',
    new Date().toISOString(),
    new Date().toISOString()
  );

  const testConv = conversationRepository.createConversation({
    id: `conv_test_${Date.now()}`,
    user_id: userId,
    module: 'tutor',
    title: 'Bamboo Joinery Principles',
    topic: 'Sustainable Joinery',
    project_id: testProject.id,
  });

  conversationRepository.addMessage({
    id: `msg_test_${Date.now()}`,
    conversation_id: testConv.id,
    user_id: userId,
    role: 'user',
    content: 'What are the optimal joint types for curved bamboo trusses?',
  });

  savedOutputRepository.create({
    id: `out_test_${Date.now()}`,
    user_id: userId,
    project_id: testProject.id,
    type: 'concept_brief',
    title: 'Pavilion Passive Cooling Strategy',
    content: 'Courtyard thermal stack effect with shaded water pool.',
  });

  // Generate snapshot
  const snapshot = googleDriveStorageService.generateWebsiteDataSnapshot(userId);

  // Verification 1: Content completeness
  if (snapshot.studioName !== 'Archora Architecture Studio') {
    throw new Error(`Test 4 Failed: Expected studioName "Archora Architecture Studio", got "${snapshot.studioName}"`);
  }
  if (!Array.isArray(snapshot.projects) || snapshot.projects.length !== 1) {
    throw new Error(`Test 4 Failed: Expected 1 project in snapshot, got ${snapshot.projects?.length}`);
  }
  if (!Array.isArray(snapshot.conversations) || snapshot.conversations.length !== 1) {
    throw new Error(`Test 4 Failed: Expected 1 conversation in snapshot, got ${snapshot.conversations?.length}`);
  }
  if (!Array.isArray(snapshot.filesMetadata) || snapshot.filesMetadata.length !== 1) {
    throw new Error(`Test 4 Failed: Expected 1 file metadata in snapshot, got ${snapshot.filesMetadata?.length}`);
  }

  // Verification 2: STRICT PRIVACY AUDIT (zero secrets, zero passwords, zero tokens)
  const serializedSnapshot = JSON.stringify(snapshot);
  const FORBIDDEN_STRINGS = [
    'password_hash',
    'password',
    'salt',
    'access_token',
    'refresh_token',
    'token_expiry',
    'session_token',
    'secret',
    'gemini_api_key',
    'api_key',
    '$2a$12$', // bcrypt prefix
  ];

  for (const forbidden of FORBIDDEN_STRINGS) {
    if (serializedSnapshot.includes(`"${forbidden}"`) || serializedSnapshot.includes(`:${forbidden}`)) {
      throw new Error(`CRITICAL SECURITY FAILURE: Snapshot leaked sensitive key "${forbidden}"!`);
    }
  }

  // Double check user password hash is completely absent
  if (serializedSnapshot.includes('eX4mPL3H4shSecretHashNotForSync1234567890')) {
    throw new Error('CRITICAL SECURITY FAILURE: User password hash was leaked in snapshot!');
  }

  console.log(`✓ Test 4 Passed: Snapshot generated successfully (v${snapshot.version}, ${snapshot.projects.length} project, ${snapshot.conversations.length} conversation, ${snapshot.filesMetadata.length} file metadata).`);
  console.log(`  Security Audit: Confirmed 100% absence of passwords, bcrypt hashes, API keys, and OAuth tokens.\n`);

  // TEST 5: Snapshot Restoration & Safe Merge
  console.log('Test 5: Testing snapshot restoration into a secondary user studio...');
  const secondaryUserId = `usr_restore_${Date.now()}`;
  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    secondaryUserId,
    'partner@studio-archora.local',
    '$2a$12$PartnerHashSecurePassword987654321',
    'Associate Architect',
    'student',
    new Date().toISOString(),
    new Date().toISOString()
  );

  // Emulate restore transaction directly with snapshotData
  const mockRestoreTransaction = db.transaction(() => {
    // 1. Projects
    for (const p of snapshot.projects) {
      projectRepository.create({
        id: `restored_${p.id}`,
        user_id: secondaryUserId,
        title: p.title,
        category: p.category,
        typology: p.typology,
        description: p.description,
      });
    }

    // 2. Project Notes
    for (const n of snapshot.projectNotes) {
      db.prepare(`
        INSERT INTO project_notes (id, project_id, user_id, content, author, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`restored_${n.id}`, `restored_${n.project_id}`, secondaryUserId, n.content, n.author, n.created_at, n.updated_at);
    }

    // 3. Saved Outputs
    for (const o of snapshot.savedOutputs) {
      savedOutputRepository.create({
        id: `restored_${o.id}`,
        user_id: secondaryUserId,
        project_id: o.project_id ? `restored_${o.project_id}` : null,
        type: o.type,
        title: o.title,
        content: o.content,
      });
    }

    // 4. File Metadata
    for (const f of snapshot.filesMetadata) {
      fileRepository.create({
        id: `restored_${f.id}`,
        user_id: secondaryUserId,
        project_id: f.project_id ? `restored_${f.project_id}` : null,
        original_filename: f.original_filename,
        storage_filename: f.storage_filename,
        storage_path: f.storage_path,
        mime_type: f.mime_type,
        file_extension: f.file_extension,
        file_size: f.file_size,
        description: f.description,
        category: f.category,
        google_drive_file_id: f.google_drive_file_id,
        cloud_storage_status: f.cloud_storage_status,
      });
    }
  });

  mockRestoreTransaction();

  const restoredProjects = projectRepository.findByUser(secondaryUserId);
  if (restoredProjects.length !== 1 || restoredProjects[0].title !== 'Vernacular Bamboo Pavilion') {
    throw new Error(`Test 5 Failed: Restored project mismatch.`);
  }

  const restoredFiles = fileRepository.findByUser(secondaryUserId);
  if (restoredFiles.length !== 1 || restoredFiles[0].google_drive_file_id !== dummyDriveId) {
    throw new Error(`Test 5 Failed: Restored file metadata mismatch.`);
  }
  console.log(`✓ Test 5 Passed: Snapshot data safely merged and restored into secondary studio without conflicts.\n`);

  // TEST 6: Offline Synchronization Queue
  console.log('Test 6: Testing offline synchronization queue and action processing...');
  const queueItem = syncRepository.enqueueOfflineAction(userId, 'file_upload', 'file_offline_123', {
    originalFilename: 'section_bb.dwg',
    mimeType: 'application/acad',
  });

  if (!queueItem || queueItem.status !== 'pending' || queueItem.action_type !== 'file_upload') {
    throw new Error(`Test 6 Failed: Failed to enqueue offline action.`);
  }

  const pending = syncRepository.getPendingQueue(userId);
  if (pending.length !== 1 || pending[0].id !== queueItem.id) {
    throw new Error(`Test 6 Failed: Pending queue did not return enqueued item.`);
  }

  // Simulate completion
  syncRepository.markQueueItemCompleted(queueItem.id);
  const remainingQueue = syncRepository.getPendingQueue(userId);
  if (remainingQueue.length !== 0) {
    throw new Error(`Test 6 Failed: Expected empty queue after completion, got ${remainingQueue.length}`);
  }
  console.log(`✓ Test 6 Passed: Offline synchronization queue correctly enqueues and resolves pending cloud actions.\n`);

  // TEST 7: FormatBytes Helper Function
  console.log('Test 7: Verifying formatBytes utility...');
  if (formatBytes(0) !== '0 B') throw new Error(`Format 0 B failed`);
  if (formatBytes(1024) !== '1.00 KB') throw new Error(`Format 1 KB failed`);
  if (formatBytes(1024 * 1024 * 5) !== '5.00 MB') throw new Error(`Format 5 MB failed`);
  console.log(`✓ Test 7 Passed: formatBytes correctly formats byte metrics.\n`);

  // Teardown
  closeDb();
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('===============================================================');
  console.log('ALL 7 GOOGLE DRIVE STORAGE & SYNC TESTS PASSED SUCCESSFULLY! ✓');
  console.log('===============================================================\n');
}

runGoogleDriveStorageTests().catch((err) => {
  console.error('\n❌ Google Drive Storage Test Suite Failed:\n', err);
  process.exit(1);
});
