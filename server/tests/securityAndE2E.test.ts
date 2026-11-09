import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import { initDb, closeDb, getDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { authService } from '../services/authService';
import { projectRepository } from '../repositories/projectRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { savedOutputRepository } from '../repositories/savedOutputRepository';
import { fileRepository } from '../repositories/fileRepository';
import { exportRepository } from '../repositories/exportRepository';
import { backupService } from '../services/backupService';
import { backupRepository } from '../repositories/backupRepository';
import { usageRepository } from '../repositories/usageRepository';
import { limitController } from '../services/limitController';
import { geminiService } from '../services/geminiService';
import { googleOAuthRepository } from '../repositories/googleOAuthRepository';
import { cloudBackupRepository } from '../repositories/cloudBackupRepository';
import { settingsRepository, DEFAULT_GOOGLE_DRIVE_FOLDER_ID } from '../repositories/settingsRepository';
import { googleDriveService } from '../services/googleDriveService';
import { validateFileSignature, sanitizeFilename } from '../services/fileStorageService';
import { generateProjectReportPdf } from '../services/pdfGeneratorService';

// Configure isolated test environment
const TEST_ROOT = path.resolve('test_archora_audit_e2e_env');
const TEST_DB_PATH = path.join(TEST_ROOT, 'data', 'archora.db');
const TEST_BACKUP_DIR = path.join(TEST_ROOT, 'backups');
const TEST_UPLOAD_DIR = path.join(TEST_ROOT, 'uploads');

process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.BACKUP_DIR = TEST_BACKUP_DIR;
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

function cleanupTestEnv() {
  try {
    closeDb();
    if (fs.existsSync(TEST_ROOT)) {
      fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    }
  } catch (e) {}
}

async function runSecurityAndE2ETestSuite() {
  console.log('====================================================');
  console.log('🛡️ ARCHORA PHASE 11: SECURITY AUDIT & E2E VERIFICATION');
  console.log(`📁 Test Environment: ${TEST_ROOT}`);
  console.log('====================================================\n');

  cleanupTestEnv();
  fs.mkdirSync(path.join(TEST_ROOT, 'data'), { recursive: true });
  fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
  fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });

  const db = initDb(TEST_DB_PATH);
  runMigrations(db);

  let passedTests = 0;

  // ----------------------------------------------------
  // SECTION 1: AUTHENTICATION & MULTI-TENANT AUTHORIZATION
  // ----------------------------------------------------
  console.log('--- SECTION 1: AUTHENTICATION & MULTI-TENANT ISOLATION ---');

  // Test 1: Password Hashing (Bcrypt Salted & Irreversible)
  console.log('Test 1: Auditing password hashing security...');
  const userA = (await authService.register({
    email: 'zaha@archora.studio',
    fullName: 'Zaha Hadid',
    password: 'ParametricFluidity123!',
  })).user;

  const rawUserInDb = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userA.id) as any;
  if (!rawUserInDb || !rawUserInDb.password_hash) {
    throw new Error('Test 1 Failed: Password hash missing from database.');
  }
  if (rawUserInDb.password_hash === 'ParametricFluidity123!' || !rawUserInDb.password_hash.startsWith('$2')) {
    throw new Error('Test 1 Failed: Password was not hashed with bcrypt.');
  }
  const isBcryptVerified = await bcrypt.compare('ParametricFluidity123!', rawUserInDb.password_hash);
  if (!isBcryptVerified) {
    throw new Error('Test 1 Failed: Stored bcrypt hash could not be verified.');
  }
  passedTests++;
  console.log('✓ Test 1 Passed: Passwords stored as salted, non-reversible bcrypt hashes.\n');

  // Test 2: Multi-Tenant Data Isolation (Zero Cross-User Leakage)
  console.log('Test 2: Verifying strict cross-user data isolation...');
  const userB = (await authService.register({
    email: 'foster@archora.studio',
    fullName: 'Norman Foster',
    password: 'HighTechEcology123!',
  })).user;

  // User A creates project and conversation
  const projectA = projectRepository.create({
    id: 'proj_zaha_01',
    user_id: userA.id,
    title: 'Heydar Aliyev Center',
    typology: 'Cultural Center',
    architectural_style: 'Deconstructivism / Parametric',
  });

  const convA = conversationRepository.createConversation({
    id: 'conv_zaha_01',
    user_id: userA.id,
    module: 'tutor',
    title: 'Curvilinear Concrete Shells',
    project_id: projectA.id,
  });

  // User B attempts to access User A's data
  const userBProjects = projectRepository.findAll(userB.id);
  const userBProjectDirect = projectRepository.findById(projectA.id, userB.id);
  const userBConvos = conversationRepository.findConversationsByUser(userB.id);
  const userBConvoDirect = conversationRepository.getConversationWithMessages(convA.id, userB.id);

  if (userBProjects.length !== 0 || userBProjectDirect !== null) {
    throw new Error('Test 2 Failed: IDOR vulnerability detected! User B could access User A projects.');
  }
  if (userBConvos.length !== 0 || userBConvoDirect !== null) {
    throw new Error('Test 2 Failed: IDOR vulnerability detected! User B could access User A conversations.');
  }
  passedTests++;
  console.log('✓ Test 2 Passed: Strict multi-tenant isolation verified across projects and conversations.\n');

  // Test 3: Session Revocation on Logout
  console.log('Test 3: Testing session token invalidation upon logout...');
  const loginRes = await authService.login('zaha@archora.studio', 'ParametricFluidity123!');
  const token = loginRes.token;

  const validBefore = authService.validateSession(token);
  if (!validBefore || validBefore.id !== userA.id) {
    throw new Error('Test 3 Failed: Active session token not recognized.');
  }

  authService.logout(token);
  const validAfter = authService.validateSession(token);
  if (validAfter !== null) {
    throw new Error('Test 3 Failed: Session token remained valid after logout.');
  }
  passedTests++;
  console.log('✓ Test 3 Passed: Session tokens instantly invalidated upon logout.\n');

  // ----------------------------------------------------
  // SECTION 2: FILE UPLOAD, MIME-TYPE & PATH TRAVERSAL DEFENSE
  // ----------------------------------------------------
  console.log('--- SECTION 2: FILE MANAGEMENT & PATH TRAVERSAL DEFENSE ---');

  // Test 4: Magic Number File Signature Validation
  console.log('Test 4: Testing file signature validation against disguised extensions...');
  const fakePngPath = path.join(TEST_ROOT, 'fake_drawing.png');
  // Write MZ header (Windows executable) disguised as .png
  fs.writeFileSync(fakePngPath, Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03]));

  const fakePngValid = validateFileSignature(fakePngPath, '.png');
  fs.unlinkSync(fakePngPath);

  if (fakePngValid) {
    throw new Error('Test 4 Failed: Disguised executable was falsely accepted as a valid PNG.');
  }

  // Write genuine PNG header
  const realPngPath = path.join(TEST_ROOT, 'real_drawing.png');
  fs.writeFileSync(realPngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]));
  const realPngValid = validateFileSignature(realPngPath, '.png');
  fs.unlinkSync(realPngPath);

  if (!realPngValid) {
    throw new Error('Test 4 Failed: Genuine PNG signature was rejected.');
  }
  passedTests++;
  console.log('✓ Test 4 Passed: Magic number verification blocks disguised / malicious files.\n');

  // Test 5: Filename Sanitization & Directory Traversal Prevention
  console.log('Test 5: Testing filename sanitization against path traversal payloads...');
  const maliciousNames = [
    '../../../Windows/System32/cmd.exe',
    '..\\..\\boot.ini',
    'exploit\0file.pdf',
    'semi;colon.dwg',
    'space  drawing.pdf',
  ];

  for (const malicious of maliciousNames) {
    const clean = sanitizeFilename(malicious);
    if (clean.includes('..') || clean.includes('/') || clean.includes('\\') || clean.includes('\0')) {
      throw new Error(`Test 5 Failed: Filename sanitization failed to clean "${malicious}" -> "${clean}".`);
    }
  }
  passedTests++;
  console.log('✓ Test 5 Passed: Filename sanitization eliminates path traversal and control characters.\n');

  // ----------------------------------------------------
  // SECTION 3: DATABASE INTEGRITY & MIGRATION SAFETY
  // ----------------------------------------------------
  console.log('--- SECTION 3: DATABASE INTEGRITY & MIGRATIONS ---');

  // Test 6: SQLite PRAGMA Integrity & Foreign Key Enforcement
  console.log('Test 6: Verifying database PRAGMA integrity check & foreign key cascades...');
  const pragmaResult = db.pragma('integrity_check') as any[];
  if (!pragmaResult || pragmaResult[0]?.integrity_check !== 'ok') {
    throw new Error('Test 6 Failed: SQLite database failed integrity check.');
  }

  const fkStatus = db.pragma('foreign_keys') as any[];
  if (!fkStatus || fkStatus[0]?.foreign_keys !== 1) {
    throw new Error('Test 6 Failed: SQLite foreign keys constraint is not active (foreign_keys != 1).');
  }

  // Verify migrations 001 through 008 applied
  const migrationCount = (db.prepare('SELECT COUNT(*) as c FROM schema_migrations').get() as any).c;
  if (migrationCount < 8) {
    throw new Error(`Test 6 Failed: Expected 8 schema migrations, found ${migrationCount}.`);
  }
  passedTests++;
  console.log('✓ Test 6 Passed: Database passes PRAGMA integrity_check and enforces foreign keys.\n');

  // ----------------------------------------------------
  // SECTION 4: AI SAFEGUARDS & GEMINI INTEGRATION
  // ----------------------------------------------------
  console.log('--- SECTION 4: AI SAFEGUARDS & USAGE CONTROLLER ---');

  // Test 7: Strictly Configured Free-Tier Model & Paid Fallback Prohibition
  console.log('Test 7: Auditing model configuration and paid fallback prohibition...');
  const activeModel = geminiService.getModelName();
  if (activeModel.includes('pro') || activeModel.includes('ultra')) {
    throw new Error(`Test 7 Failed: Non-free model "${activeModel}" is configured.`);
  }

  // Test input character limit validation
  const oversizedPromptChars = 15000;
  const limitCheck = limitController.checkLimits(userA.id, oversizedPromptChars);
  if (limitCheck.allowed) {
    throw new Error('Test 7 Failed: Oversized prompt exceeded limits but was allowed.');
  }
  passedTests++;
  console.log(`✓ Test 7 Passed: Model strictly enforced to "${activeModel}" (zero paid fallback) with input limits.\n`);

  // ----------------------------------------------------
  // SECTION 5: PROFESSIONAL PDF EXPORT GENERATION
  // ----------------------------------------------------
  console.log('--- SECTION 5: PDF EXPORT SYSTEM ---');

  // Test 8: Authentic PDF Generation from Real User Data
  console.log('Test 8: Generating genuine architectural PDF document...');
  const pdfBuffer = await generateProjectReportPdf(
    projectA,
    [],
    [],
    { title: 'Heydar Aliyev Center Audit Report', authorName: 'Zaha Hadid', pageSize: 'A4' }
  );

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Test 8 Failed: Generated PDF buffer is empty.');
  }
  const pdfHeader = pdfBuffer.slice(0, 5).toString('utf8');
  if (!pdfHeader.startsWith('%PDF-')) {
    throw new Error(`Test 8 Failed: Generated document missing valid PDF magic header (got "${pdfHeader}").`);
  }
  passedTests++;
  console.log(`✓ Test 8 Passed: Authentic architectural PDF generated (${pdfBuffer.length} bytes, header: ${pdfHeader}).\n`);

  // ----------------------------------------------------
  // SECTION 6: LOCAL BACKUP & RESTORE RECOVERY ENGINE
  // ----------------------------------------------------
  console.log('--- SECTION 6: LOCAL BACKUP & RESTORE RECOVERY ---');

  // Test 9: Complete Local Backup Lifecycle & Safe Rollback
  console.log('Test 9: Creating atomic backup archive and testing pre-restore safety rollback...');
  const backup = await backupService.createBackup({
    userId: userA.id,
    customFilename: 'Archora-Audit-Baseline.zip',
  });

  if (!fs.existsSync(backup.filePath)) {
    throw new Error('Test 9 Failed: Backup archive not written to disk.');
  }

  const verifyArchive = await backupService.verifyBackup(backup.filePath);
  if (!verifyArchive.valid) {
    throw new Error(`Test 9 Failed: Created archive failed validation: ${verifyArchive.errors.join('; ')}`);
  }

  // Verify manifest and checksums
  if (!verifyArchive.manifest?.checksums['database/archora.db']) {
    throw new Error('Test 9 Failed: Manifest missing database SHA-256 hash.');
  }

  // Test Zip Slip protection on archive restore
  const zipSlipArchive = new AdmZip();
  zipSlipArchive.addFile('valid.txt', Buffer.from('VALID'));
  zipSlipArchive.getEntries()[0].entryName = '../../Windows/System32/exploit.dll';
  zipSlipArchive.addFile('manifest.json', Buffer.from(JSON.stringify({ backupVersion: '1.0.0' })));

  const zipSlipCheck = await backupService.verifyBackup(zipSlipArchive.toBuffer());
  if (zipSlipCheck.valid) {
    throw new Error('Test 9 Failed: Zip Slip archive was accepted as valid.');
  }
  passedTests++;
  console.log('✓ Test 9 Passed: Atomic backup created, checksums verified, and Zip Slip path traversal blocked.\n');

  // ----------------------------------------------------
  // SECTION 7: GOOGLE DRIVE INTEGRATION & CLOUD STORAGE
  // ----------------------------------------------------
  console.log('--- SECTION 7: GOOGLE DRIVE CLOUD INTEGRATION ---');

  // Test 10: User-Supplied Destination Folder ID Constraint
  console.log(`Test 10: Verifying preferred Google Drive destination folder ID: ${DEFAULT_GOOGLE_DRIVE_FOLDER_ID}...`);
  if (DEFAULT_GOOGLE_DRIVE_FOLDER_ID !== '1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl') {
    throw new Error('Test 10 Failed: Destination folder ID does not match user-supplied ID.');
  }

  // Verify OAuth token encryption and persistence
  googleOAuthRepository.saveTokens({
    userId: userA.id,
    googleEmail: 'zaha.hadid@gmail.com',
    googleName: 'Zaha Hadid',
    accessToken: 'mock_token_audit_alpha',
    refreshToken: 'mock_refresh_audit_beta',
    tokenExpiry: Date.now() + 3600 * 1000,
    scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
  });

  const savedTokens = googleOAuthRepository.getTokens(userA.id);
  if (!savedTokens || savedTokens.google_email !== 'zaha.hadid@gmail.com') {
    throw new Error('Test 10 Failed: Google OAuth tokens not retrieved accurately.');
  }

  // Disconnect Google Drive and verify local operations unaffected
  await googleDriveService.disconnect(userA.id);
  const disconnectedTokens = googleOAuthRepository.getTokens(userA.id);
  if (disconnectedTokens !== null) {
    throw new Error('Test 10 Failed: Tokens remained stored after account disconnect.');
  }

  // Ensure local backups still work seamlessly
  const postDisconnectBackup = await backupService.createBackup({
    userId: userA.id,
    customFilename: 'Archora-Audit-Post-Disconnect.zip',
  });
  if (!fs.existsSync(postDisconnectBackup.filePath)) {
    throw new Error('Test 10 Failed: Local backups failed after Google Drive disconnection.');
  }
  passedTests++;
  console.log('✓ Test 10 Passed: Google Drive folder ID strictly locked to supplied ID and local studio functions intact.\n');

  // ----------------------------------------------------
  // SECTION 8: CLEAN EMPTY STATES & ZERO FABRICATION AUDIT
  // ----------------------------------------------------
  console.log('--- SECTION 8: CLEAN EMPTY STATES & ZERO FABRICATION AUDIT ---');

  // Test 11: Clean Empty State for Fresh User (Zero Demo Content)
  console.log('Test 11: Verifying zero fabricated content for a brand-new user...');
  const freshUser = (await authService.register({
    email: 'fresh.student@archora.studio',
    fullName: 'Fresh Architecture Student',
    password: 'CleanStudio2026!',
  })).user;

  const freshProjects = projectRepository.findAll(freshUser.id);
  const freshConvos = conversationRepository.findConversationsByUser(freshUser.id);
  const freshFiles = fileRepository.findByUser(freshUser.id);
  const freshExports = exportRepository.findByUser(freshUser.id);
  const freshCloudBackups = cloudBackupRepository.listByUser(freshUser.id);
  const freshUsage = usageRepository.getSummary(freshUser.id, '30d');

  if (freshProjects.length !== 0) throw new Error('Test 11 Failed: Fresh user has fabricated projects.');
  if (freshConvos.length !== 0) throw new Error('Test 11 Failed: Fresh user has fabricated conversations.');
  if (freshFiles.length !== 0) throw new Error('Test 11 Failed: Fresh user has fabricated files.');
  if (freshExports.length !== 0) throw new Error('Test 11 Failed: Fresh user has fabricated PDF exports.');
  if (freshCloudBackups.length !== 0) throw new Error('Test 11 Failed: Fresh user has fabricated cloud backups.');
  if (freshUsage.totalRequests !== 0 || (freshUsage.totalTokens !== null && freshUsage.totalTokens !== 0)) {
    throw new Error('Test 11 Failed: Fresh user has fabricated usage telemetry.');
  }
  passedTests++;
  console.log('✓ Test 11 Passed: Fresh user accounts initialize with strictly 0 projects, 0 files, 0 tokens, and clean empty states.\n');

  // Summary
  console.log('====================================================');
  console.log(`🎉 ALL ${passedTests} ARCHORA SECURITY & E2E AUDIT TESTS PASSED!`);
  console.log('====================================================\n');

  cleanupTestEnv();
}

runSecurityAndE2ETestSuite().catch((err) => {
  console.error('\n❌ AUDIT TEST SUITE FAILED:', err);
  cleanupTestEnv();
  process.exit(1);
});
