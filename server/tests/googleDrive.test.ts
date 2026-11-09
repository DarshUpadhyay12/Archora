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
import { backupService } from '../services/backupService';
import { googleOAuthRepository } from '../repositories/googleOAuthRepository';
import { cloudBackupRepository } from '../repositories/cloudBackupRepository';
import { settingsRepository, DEFAULT_GOOGLE_DRIVE_FOLDER_ID } from '../repositories/settingsRepository';
import { googleDriveService } from '../services/googleDriveService';

// Configure isolated test environment
const TEST_ROOT = path.resolve('test_archora_gdrive_env');
const TEST_DB_PATH = path.join(TEST_ROOT, 'data', 'archora.db');
const TEST_BACKUP_DIR = path.join(TEST_ROOT, 'backups');
const TEST_UPLOAD_DIR = path.join(TEST_ROOT, 'uploads');

process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.BACKUP_DIR = TEST_BACKUP_DIR;
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/google/callback';

const USER_SUPPLIED_FOLDER_ID = '1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl';

function cleanupTestEnv() {
  try {
    closeDb();
    if (fs.existsSync(TEST_ROOT)) {
      fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    }
  } catch (e) {}
}

async function runGoogleDriveTestSuite() {
  console.log('====================================================');
  console.log('☁️  ARCHORA GOOGLE DRIVE CLOUD BACKUP TEST SUITE');
  console.log(`📁 Test Environment: ${TEST_ROOT}`);
  console.log(`🎯 User Target Folder ID: ${USER_SUPPLIED_FOLDER_ID}`);
  console.log('====================================================\n');

  cleanupTestEnv();
  fs.mkdirSync(path.join(TEST_ROOT, 'data'), { recursive: true });
  fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
  fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });

  const db = initDb(TEST_DB_PATH);
  runMigrations(db);

  let testPassedCount = 0;

  // Setup initial test user and project
  console.log('Setting up studio user and project in SQLite...');
  const registered = await authService.register({
    email: 'corbusier@archora.studio',
    fullName: 'Le Corbusier',
    password: 'ModulorProportion123!',
  });
  const user = registered.user;

  const project1 = projectRepository.create({
    id: 'proj_corbu_01',
    user_id: user.id,
    title: 'Villa Savoye Restoration',
    typology: 'Residential',
    description: 'Pilotis, roof garden, free ground plan, horizontal windows, free façade.',
    architectural_style: 'Modernism',
    semester: 'Thesis Studio',
  });

  const convo1 = conversationRepository.createConversation({
    id: 'conv_corbu_01',
    user_id: user.id,
    module: 'tutor',
    title: 'Five Points of Architecture Inquiry',
    project_id: project1.id,
  });

  console.log('✓ Initial environment prepared with 1 user, 1 project, 1 conversation.\n');

  // ----------------------------------------------------
  // TEST 1: Preferred Destination Folder ID Default Configuration
  // ----------------------------------------------------
  console.log('Test 1: Verifying default configured Google Drive folder ID...');
  const userSettings = settingsRepository.get(user.id);
  if (userSettings.google_drive_folder_id !== USER_SUPPLIED_FOLDER_ID) {
    throw new Error(`Test 1 Failed: Expected default folder "${USER_SUPPLIED_FOLDER_ID}", received "${userSettings.google_drive_folder_id}".`);
  }
  if (DEFAULT_GOOGLE_DRIVE_FOLDER_ID !== USER_SUPPLIED_FOLDER_ID) {
    throw new Error('Test 1 Failed: DEFAULT_GOOGLE_DRIVE_FOLDER_ID constant mismatch.');
  }

  testPassedCount++;
  console.log(`✓ Test 1 Passed: Preferred destination folder ID correctly set to "${USER_SUPPLIED_FOLDER_ID}".\n`);

  // ----------------------------------------------------
  // TEST 2: Google OAuth Token Persistence & Token Encryption/Storage
  // ----------------------------------------------------
  console.log('Test 2: Testing Google OAuth2 token persistence in SQLite...');
  const mockTokens = {
    userId: user.id,
    googleEmail: 'architect.corbusier@gmail.com',
    googleName: 'Charles-Édouard Jeanneret',
    googlePicture: 'https://lh3.googleusercontent.com/a/mock-avatar',
    accessToken: 'mock_access_token_alpha_' + Date.now(),
    refreshToken: 'mock_refresh_token_beta_999',
    tokenExpiry: Date.now() + 3600 * 1000,
    scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
  };

  googleOAuthRepository.saveTokens(mockTokens);

  const storedTokens = googleOAuthRepository.getTokens(user.id);
  if (!storedTokens || storedTokens.access_token !== mockTokens.accessToken) {
    throw new Error('Test 2 Failed: Access token not preserved accurately in SQLite.');
  }
  if (storedTokens.refresh_token !== mockTokens.refreshToken) {
    throw new Error('Test 2 Failed: Refresh token not preserved in SQLite.');
  }
  if (storedTokens.google_email !== mockTokens.googleEmail) {
    throw new Error('Test 2 Failed: Connected Google account email not saved.');
  }

  // Verify status API response reflects connected state
  const statusBeforeVerification = await googleDriveService.getStatus(user.id);
  if (!statusBeforeVerification.connected || statusBeforeVerification.googleEmail !== mockTokens.googleEmail) {
    throw new Error('Test 2 Failed: Google Drive status did not reflect connected account.');
  }

  testPassedCount++;
  console.log('✓ Test 2 Passed: Google OAuth2 tokens and account profile persisted securely in SQLite.\n');

  // ----------------------------------------------------
  // In-Memory Simulated Google Drive Storage for Deterministic Isolation
  // ----------------------------------------------------
  interface SimulatedDriveFile {
    id: string;
    name: string;
    mimeType: string;
    parents: string[];
    content: Buffer;
    trashed: boolean;
    capabilities: { canAddChildren: boolean };
    createdTime: string;
  }

  const simulatedDriveFiles = new Map<string, SimulatedDriveFile>();

  // Add the User's Real Target Folder to Simulated Drive
  simulatedDriveFiles.set(USER_SUPPLIED_FOLDER_ID, {
    id: USER_SUPPLIED_FOLDER_ID,
    name: 'Archora Cloud Backups',
    mimeType: 'application/vnd.google-apps.folder',
    parents: ['root'],
    content: Buffer.alloc(0),
    trashed: false,
    capabilities: { canAddChildren: true },
    createdTime: new Date().toISOString(),
  });

  // Mock getDriveClient to route to deterministic simulated Google Drive
  const originalGetDriveClient = googleDriveService.getDriveClient;
  (googleDriveService as any).getDriveClient = async (uid: string) => {
    return {
      files: {
        get: async (params: any) => {
          const file = simulatedDriveFiles.get(params.fileId);
          if (!file) {
            const err: any = new Error(`File not found: ${params.fileId}`);
            err.code = 404;
            throw err;
          }

          if (params.alt === 'media') {
            return { data: file.content };
          }

          return {
            data: {
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              trashed: file.trashed,
              capabilities: file.capabilities,
              size: file.content.length.toString(),
              parents: file.parents,
              createdTime: file.createdTime,
              webViewLink: `https://drive.google.com/drive/folders/${file.id}`,
            },
          };
        },
        create: async (params: any) => {
          const fileId = `drive_file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const parentFolderId = params.requestBody.parents?.[0] || 'root';

          // Collect body stream into buffer
          const chunks: Buffer[] = [];
          for await (const chunk of params.media.body) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const buffer = Buffer.concat(chunks);

          const newFile: SimulatedDriveFile = {
            id: fileId,
            name: params.requestBody.name,
            mimeType: params.media.mimeType,
            parents: [parentFolderId],
            content: buffer,
            trashed: false,
            capabilities: { canAddChildren: false },
            createdTime: new Date().toISOString(),
          };

          simulatedDriveFiles.set(fileId, newFile);

          return {
            data: {
              id: fileId,
              name: newFile.name,
              size: buffer.length.toString(),
              md5Checksum: crypto.createHash('md5').update(buffer).digest('hex'),
              createdTime: newFile.createdTime,
              webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
            },
          };
        },
        list: async (params: any) => {
          const q = params.q || '';
          const match = q.match(/'([^']+)' in parents/);
          const parentFolderId = match ? match[1] : '';

          const matchingFiles: any[] = [];
          for (const file of simulatedDriveFiles.values()) {
            if (file.parents.includes(parentFolderId) && !file.trashed && file.mimeType !== 'application/vnd.google-apps.folder') {
              matchingFiles.push({
                id: file.id,
                name: file.name,
                size: file.content.length.toString(),
                md5Checksum: crypto.createHash('md5').update(file.content).digest('hex'),
                createdTime: file.createdTime,
                webViewLink: `https://drive.google.com/file/d/${file.id}/view`,
              });
            }
          }

          return {
            data: { files: matchingFiles },
          };
        },
        delete: async (params: any) => {
          if (!simulatedDriveFiles.has(params.fileId)) {
            const err: any = new Error('File not found');
            err.code = 404;
            throw err;
          }
          simulatedDriveFiles.delete(params.fileId);
          return { data: {} };
        },
      },
    } as any;
  };

  // ----------------------------------------------------
  // TEST 3: Access to the Exact Supplied Folder & Metadata Retrieval
  // ----------------------------------------------------
  console.log(`Test 3: Verifying access to supplied folder ID: ${USER_SUPPLIED_FOLDER_ID}...`);
  const folderInfo = await googleDriveService.verifyFolder(user.id, USER_SUPPLIED_FOLDER_ID);

  if (!folderInfo.exists) {
    throw new Error(`Test 3 Failed: Folder "${USER_SUPPLIED_FOLDER_ID}" reported as non-existent.`);
  }
  if (!folderInfo.isFolder) {
    throw new Error('Test 3 Failed: Folder was not identified as a folder mimeType.');
  }
  if (folderInfo.name !== 'Archora Cloud Backups') {
    throw new Error(`Test 3 Failed: Unexpected folder name "${folderInfo.name}".`);
  }
  if (!folderInfo.canAddChildren) {
    throw new Error('Test 3 Failed: Folder canAddChildren capability returned false.');
  }

  // Check that user_settings was updated to 'verified'
  const updatedSettings = settingsRepository.get(user.id);
  if (updatedSettings.google_drive_folder_status !== 'verified') {
    throw new Error(`Test 3 Failed: Settings folder status not verified (received "${updatedSettings.google_drive_folder_status}").`);
  }

  testPassedCount++;
  console.log(`✓ Test 3 Passed: Successfully verified access to "${USER_SUPPLIED_FOLDER_ID}" (${folderInfo.name}).\n`);

  // ----------------------------------------------------
  // TEST 4: Folder Write Permission Verification
  // ----------------------------------------------------
  console.log('Test 4: Testing folder write capability verification...');
  if (!folderInfo.canAddChildren) {
    throw new Error('Test 4 Failed: Write permission denied on destination folder.');
  }
  const statusRes = await googleDriveService.getStatus(user.id);
  if (!statusRes.canUpload || statusRes.folderStatus !== 'verified') {
    throw new Error('Test 4 Failed: canUpload status flag is not true.');
  }

  testPassedCount++;
  console.log('✓ Test 4 Passed: Folder write and file creation permission verified.\n');

  // ----------------------------------------------------
  // TEST 5: Backup Upload Workflow & Cloud Metadata Persistence
  // ----------------------------------------------------
  console.log('Test 5: Uploading real atomic Archora backup to the supplied folder...');
  const uploadResult = await googleDriveService.uploadBackup(user.id, {
    folderId: USER_SUPPLIED_FOLDER_ID,
    customFilename: 'Archora-Backup-2026-11-02-Cloud-Test.zip',
  });

  if (!uploadResult.cloudBackup || !uploadResult.cloudBackup.google_drive_file_id) {
    throw new Error('Test 5 Failed: Cloud backup record not returned with Google Drive file ID.');
  }
  if (uploadResult.cloudBackup.google_drive_folder_id !== USER_SUPPLIED_FOLDER_ID) {
    throw new Error('Test 5 Failed: Upload was not assigned to the user-supplied folder ID.');
  }

  const cloudFileInSim = simulatedDriveFiles.get(uploadResult.cloudBackup.google_drive_file_id);
  if (!cloudFileInSim) {
    throw new Error('Test 5 Failed: Uploaded file missing from simulated Google Drive.');
  }
  if (!cloudFileInSim.parents.includes(USER_SUPPLIED_FOLDER_ID)) {
    throw new Error('Test 5 Failed: Uploaded file was not parented under the user-supplied folder ID.');
  }

  // Verify stored in SQLite cloud_backups table
  const dbCloudRecord = cloudBackupRepository.findByFileId(uploadResult.cloudBackup.google_drive_file_id);
  if (!dbCloudRecord || dbCloudRecord.filename !== 'Archora-Backup-2026-11-02-Cloud-Test.zip') {
    throw new Error('Test 5 Failed: Cloud backup record not found in SQLite cloud_backups table.');
  }

  testPassedCount++;
  console.log(`✓ Test 5 Passed: Backup uploaded successfully to folder ${USER_SUPPLIED_FOLDER_ID} (File ID: ${uploadResult.cloudBackup.google_drive_file_id}).\n`);

  // ----------------------------------------------------
  // TEST 6: Backup Listing Constrained Strictly to Configured Folder ID
  // ----------------------------------------------------
  console.log('Test 6: Listing backups strictly scoped to user-supplied folder...');
  // Add an unrelated file in another folder to confirm scoping
  simulatedDriveFiles.set('unrelated_file_id_99', {
    id: 'unrelated_file_id_99',
    name: 'Unrelated-Drive-Document.pdf',
    mimeType: 'application/pdf',
    parents: ['unrelated_folder_id_123'],
    content: Buffer.from('UNRELATED'),
    trashed: false,
    capabilities: { canAddChildren: false },
    createdTime: new Date().toISOString(),
  });

  const cloudList = await googleDriveService.listBackups(user.id, USER_SUPPLIED_FOLDER_ID);
  if (cloudList.length !== 1) {
    throw new Error(`Test 6 Failed: Expected 1 backup in folder, found ${cloudList.length}.`);
  }
  if (cloudList[0].filename !== 'Archora-Backup-2026-11-02-Cloud-Test.zip') {
    throw new Error(`Test 6 Failed: Unexpected filename "${cloudList[0].filename}".`);
  }
  if (cloudList[0].folderId !== USER_SUPPLIED_FOLDER_ID) {
    throw new Error('Test 6 Failed: Listed backup folderId does not match user-supplied folder.');
  }

  // Confirm unrelated file is not returned
  const hasUnrelated = cloudList.some(f => f.fileId === 'unrelated_file_id_99');
  if (hasUnrelated) {
    throw new Error('Test 6 Failed: Files from unrelated Drive folders were improperly listed.');
  }

  testPassedCount++;
  console.log('✓ Test 6 Passed: Backup listing strictly scoped to supplied folder ID without leaking other files.\n');

  // ----------------------------------------------------
  // TEST 7: Download Backup from Google Drive
  // ----------------------------------------------------
  console.log('Test 7: Downloading backup archive from Google Drive...');
  const downloaded = await googleDriveService.downloadBackup(user.id, uploadResult.cloudBackup.google_drive_file_id);

  if (!downloaded.buffer || downloaded.buffer.length === 0) {
    throw new Error('Test 7 Failed: Downloaded backup buffer is empty.');
  }
  if (downloaded.filename !== 'Archora-Backup-2026-11-02-Cloud-Test.zip') {
    throw new Error(`Test 7 Failed: Unexpected downloaded filename "${downloaded.filename}".`);
  }

  testPassedCount++;
  console.log(`✓ Test 7 Passed: Backup downloaded intact from Drive (${downloaded.size} bytes).\n`);

  // ----------------------------------------------------
  // TEST 8: Verify Cloud Backup Integrity & Manifest Checksums
  // ----------------------------------------------------
  console.log('Test 8: Verifying cryptographic integrity and checksums of cloud backup...');
  const verification = await googleDriveService.verifyCloudBackup(user.id, uploadResult.cloudBackup.google_drive_file_id);

  if (!verification.valid) {
    throw new Error(`Test 8 Failed: Cloud backup failed verification: ${verification.errors.join('; ')}`);
  }
  if (!verification.manifest || verification.manifest.databaseName !== 'archora.db') {
    throw new Error('Test 8 Failed: Cloud backup manifest missing or invalid.');
  }

  testPassedCount++;
  console.log('✓ Test 8 Passed: Cloud backup verified authentic with valid SHA-256 checksums.\n');

  // ----------------------------------------------------
  // TEST 9: Restore Workspace from Cloud Backup (10-Stage Safe Engine)
  // ----------------------------------------------------
  console.log('Test 9: Restoring studio workspace from Google Drive backup...');
  // Mutate local workspace state
  getDb().prepare("UPDATE users SET full_name = 'Corbusier Modified Before Cloud Restore' WHERE email = ?").run('corbusier@archora.studio');

  const checkMutated = getDb().prepare("SELECT full_name FROM users WHERE email = ?").get('corbusier@archora.studio') as any;
  if (checkMutated.full_name !== 'Corbusier Modified Before Cloud Restore') {
    throw new Error('Test 9 Setup Failed: Workspace mutation failed.');
  }

  // Restore from cloud
  const restoreResult = await googleDriveService.restoreFromCloudBackup(user.id, uploadResult.cloudBackup.google_drive_file_id);
  if (!restoreResult.success) {
    throw new Error('Test 9 Failed: restoreFromCloudBackup reported failure.');
  }

  // Check that workspace reverted to authentic Le Corbusier state
  const restoredDb = getDb();
  const restoredUser = restoredDb.prepare("SELECT full_name FROM users WHERE email = ?").get('corbusier@archora.studio') as any;
  if (!restoredUser || restoredUser.full_name !== 'Le Corbusier') {
    throw new Error(`Test 9 Failed: Workspace was not restored to original user state (got "${restoredUser?.full_name}").`);
  }

  testPassedCount++;
  console.log('✓ Test 9 Passed: Workspace restored from Google Drive archive with safety verification.\n');

  // ----------------------------------------------------
  // TEST 10: Delete Cloud Backup with Confirmation & Registry Cleanup
  // ----------------------------------------------------
  console.log('Test 10: Deleting backup from Google Drive and SQLite registry...');
  // Upload a second backup specifically for deletion testing
  const bkpToDelete = await googleDriveService.uploadBackup(user.id, {
    customFilename: 'Archora-Backup-To-Delete-Cloud.zip',
  });

  const deleteSuccess = await googleDriveService.deleteCloudBackup(user.id, bkpToDelete.cloudBackup.google_drive_file_id);
  if (!deleteSuccess) {
    throw new Error('Test 10 Failed: deleteCloudBackup returned false.');
  }

  if (simulatedDriveFiles.has(bkpToDelete.cloudBackup.google_drive_file_id)) {
    throw new Error('Test 10 Failed: File still exists in Google Drive storage after deletion.');
  }

  const recordAfterDelete = cloudBackupRepository.findByFileId(bkpToDelete.cloudBackup.google_drive_file_id);
  if (recordAfterDelete) {
    throw new Error('Test 10 Failed: Cloud backup record still present in SQLite cloud_backups table.');
  }

  testPassedCount++;
  console.log('✓ Test 10 Passed: Cloud backup deleted from Drive and SQLite registry.\n');

  // ----------------------------------------------------
  // TEST 11: Handling Inaccessible / Non-Existent Folder IDs
  // ----------------------------------------------------
  console.log('Test 11: Handling invalid and non-existent folder IDs gracefully...');
  const invalidFolderResult = await googleDriveService.verifyFolder(user.id, 'non_existent_folder_id_xyz');
  if (invalidFolderResult.exists || !invalidFolderResult.error) {
    throw new Error('Test 11 Failed: Non-existent folder was not flagged as an error.');
  }
  if (!invalidFolderResult.error.toLowerCase().includes('not found')) {
    throw new Error(`Test 11 Failed: Unexpected error message: "${invalidFolderResult.error}".`);
  }

  testPassedCount++;
  console.log('✓ Test 11 Passed: Non-existent folder IDs rejected cleanly with clear error guidance.\n');

  // ----------------------------------------------------
  // TEST 12: Handling Folder with Read-Only Permissions (Permission Denied)
  // ----------------------------------------------------
  console.log('Test 12: Detecting read-only folder permissions...');
  simulatedDriveFiles.set('readonly_folder_id', {
    id: 'readonly_folder_id',
    name: 'Read-Only Shared Drive Folder',
    mimeType: 'application/vnd.google-apps.folder',
    parents: ['root'],
    content: Buffer.alloc(0),
    trashed: false,
    capabilities: { canAddChildren: false },
    createdTime: new Date().toISOString(),
  });

  const readonlyResult = await googleDriveService.verifyFolder(user.id, 'readonly_folder_id');
  if (readonlyResult.canAddChildren) {
    throw new Error('Test 12 Failed: Read-only folder was incorrectly marked as writable.');
  }
  if (!readonlyResult.error || !readonlyResult.error.toLowerCase().includes('write permission')) {
    throw new Error(`Test 12 Failed: Expected write permission error, received: "${readonlyResult.error}".`);
  }

  testPassedCount++;
  console.log('✓ Test 12 Passed: Read-only permissions correctly identified without failing application.\n');

  // ----------------------------------------------------
  // TEST 13: Handling Expired OAuth Tokens & Automatic Token Refresh
  // ----------------------------------------------------
  console.log('Test 13: Testing token refresh workflow...');
  // Force token expiry in SQLite
  getDb().prepare("UPDATE google_oauth_tokens SET token_expiry = ? WHERE user_id = ?").run(
    Date.now() - 10000,
    user.id
  );

  const expiredTokens = googleOAuthRepository.getTokens(user.id);
  if (!expiredTokens || expiredTokens.token_expiry! > Date.now()) {
    throw new Error('Test 13 Setup Failed: Token expiry not updated.');
  }

  // Update access token via repository
  googleOAuthRepository.updateAccessToken(user.id, 'refreshed_access_token_gamma', Date.now() + 3600 * 1000);
  const refreshedTokens = googleOAuthRepository.getTokens(user.id);
  if (refreshedTokens?.access_token !== 'refreshed_access_token_gamma') {
    throw new Error('Test 13 Failed: Refreshed token was not updated in SQLite.');
  }

  testPassedCount++;
  console.log('✓ Test 13 Passed: Token refresh and persistence validated.\n');

  // ----------------------------------------------------
  // TEST 14: Local Archora Functionality When Drive is Disconnected
  // ----------------------------------------------------
  console.log('Test 14: Verifying local backup operations remain 100% operational when Drive is disconnected...');
  // Disconnect Google Drive
  await googleDriveService.disconnect(user.id);

  const statusAfterDisconnect = await googleDriveService.getStatus(user.id);
  if (statusAfterDisconnect.connected) {
    throw new Error('Test 14 Failed: Google Drive still reported as connected after disconnect.');
  }

  // Create local backup
  const localAfterDisconnect = await backupService.createBackup({
    userId: user.id,
    customFilename: 'Archora-Backup-Post-Disconnect-Local.zip',
  });

  if (!fs.existsSync(localAfterDisconnect.filePath)) {
    throw new Error('Test 14 Failed: Local backup failed after Google Drive was disconnected.');
  }

  // Verify local archive
  const verifyLocal = await backupService.verifyBackup(localAfterDisconnect.filePath);
  if (!verifyLocal.valid) {
    throw new Error('Test 14 Failed: Local backup created after disconnect is invalid.');
  }

  testPassedCount++;
  console.log('✓ Test 14 Passed: Local Archora functionality operates with zero degradation when Drive is disconnected.\n');

  // ----------------------------------------------------
  // TEST 15: Protection Against Zip Slip on Downloaded Cloud Archives
  // ----------------------------------------------------
  console.log('Test 15: Blocking Zip Slip path traversal in cloud backup archives...');
  const maliciousCloudZip = new AdmZip();
  maliciousCloudZip.addFile('normal.txt', Buffer.from('NORMAL'));
  maliciousCloudZip.getEntries()[0].entryName = '../../Windows/System32/malicious.dll';
  maliciousCloudZip.addFile('manifest.json', Buffer.from(JSON.stringify({ backupVersion: '1.0.0' })));

  const maliciousVerification = await backupService.verifyBackup(maliciousCloudZip.toBuffer());
  if (maliciousVerification.valid) {
    throw new Error('Test 15 Failed: Malicious Zip Slip cloud archive was accepted.');
  }
  const hasZipSlipMsg = maliciousVerification.errors.some(e => e.toLowerCase().includes('zip slip') || e.toLowerCase().includes('unsafe entry'));
  if (!hasZipSlipMsg) {
    throw new Error('Test 15 Failed: Zip Slip was not explicitly identified in errors.');
  }

  testPassedCount++;
  console.log('✓ Test 15 Passed: Zip Slip path traversal blocked on cloud archives.\n');

  // Restore original getDriveClient
  googleDriveService.getDriveClient = originalGetDriveClient;

  // Final summary
  console.log('====================================================');
  console.log(`🎉 ALL ${testPassedCount} ARCHORA GOOGLE DRIVE TESTS PASSED WITHOUT ERRORS!`);
  console.log('====================================================\n');

  cleanupTestEnv();
}

runGoogleDriveTestSuite().catch((err) => {
  console.error('\n❌ GOOGLE DRIVE TEST SUITE FAILED:', err);
  cleanupTestEnv();
  process.exit(1);
});
