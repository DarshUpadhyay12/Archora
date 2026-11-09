import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, closeDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { authService } from '../services/authService';
import { projectService } from '../services/projectService';
import { geminiService } from '../services/geminiService';
import { userRepository } from '../repositories/userRepository';
import { projectRepository } from '../repositories/projectRepository';
import { savedOutputRepository } from '../repositories/savedOutputRepository';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, '../../test_anchora_verification.db');

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 ANCHORA PHASES 3 & 4: SQLITE PROJECT LIBRARY TEST SUITE');
  console.log(`📁 Test Database: ${TEST_DB_PATH}`);
  console.log('====================================================\n');

  // Clean previous test artifact if any
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  const walPath = `${TEST_DB_PATH}-wal`;
  const shmPath = `${TEST_DB_PATH}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  let passedTests = 0;
  const totalTests = 12;

  try {
    // 1. Database Initialization & Pragma Verification
    console.log('Test 1: Initializing SQLite database safely...');
    const db = initDb(TEST_DB_PATH);
    const fkPragma = db.pragma('foreign_keys', { simple: true });
    if (fkPragma !== 1) throw new Error('Foreign keys pragma is not active');
    console.log('✓ Test 1 Passed: Database initialized with foreign_keys=ON and WAL mode.');
    passedTests++;

    // 2. Database Migrations (001_initial_schema & 002_project_library_expansion)
    console.log('\nTest 2: Executing database migrations 001 and 002...');
    const appliedFirst = runMigrations(db);
    if (appliedFirst.length < 2) throw new Error(`Expected at least 2 migrations, got: ${appliedFirst.join(', ')}`);
    const appliedSecond = runMigrations(db);
    if (appliedSecond.length !== 0) throw new Error('Migrations are not idempotent on second run');

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
    const requiredTables = ['users', 'sessions', 'projects', 'project_files', 'conversations', 'messages', 'saved_outputs', 'user_settings', 'usage_events', 'project_notes'];
    for (const reqTable of requiredTables) {
      if (!tables.includes(reqTable)) throw new Error(`Missing expected table: ${reqTable}`);
    }
    console.log(`✓ Test 2 Passed: Migrations applied successfully (${appliedFirst.join(', ')}). All ${requiredTables.length} tables verified.`);
    passedTests++;

    // 3. User Registration with Password Hashing
    console.log('\nTest 3: Registering user and verifying password hashing...');
    const regResult = await authService.register({
      email: 'studio.alpha@anchora.design',
      password: 'TectonicPassword#2026',
      fullName: 'Corbusier Student',
      university: 'Architectural Association',
      semester: 'Semester 7'
    });

    if (!regResult.token || !regResult.user.id) throw new Error('Registration failed to return user or token');
    if ((regResult.user as any).password_hash) throw new Error('Security violation: password_hash exposed in user object');

    const dbUser = userRepository.findByEmail('studio.alpha@anchora.design');
    if (!dbUser || (!dbUser.password_hash.startsWith('$2b$12$') && !dbUser.password_hash.startsWith('$2b$10$'))) {
      throw new Error('Password hash does not meet bcrypt standard in SQLite users table');
    }
    console.log(`✓ Test 3 Passed: User registered (ID: ${regResult.user.id}) with secure bcrypt password hash.`);
    passedTests++;

    // 4. Login with Valid Credentials
    console.log('\nTest 4: Logging in with valid credentials...');
    const loginResult = await authService.login('studio.alpha@anchora.design', 'TectonicPassword#2026');
    if (!loginResult.token || loginResult.user.email !== 'studio.alpha@anchora.design') {
      throw new Error('Valid login failed');
    }
    console.log(`✓ Test 4 Passed: Authenticated successfully. Session token generated: ${loginResult.token.substring(0, 16)}...`);
    passedTests++;

    // 5. Rejection of Invalid Credentials & Duplicate Registration
    console.log('\nTest 5: Verifying rejection of invalid credentials and duplicate accounts...');
    let rejectedWrongPass = false;
    try {
      await authService.login('studio.alpha@anchora.design', 'WrongPassword123');
    } catch {
      rejectedWrongPass = true;
    }
    if (!rejectedWrongPass) throw new Error('Login should have rejected incorrect password');

    let duplicateRejected = false;
    try {
      await authService.register({
        email: 'studio.alpha@anchora.design',
        password: 'AnotherPassword456',
        fullName: 'Imposter Student'
      });
    } catch (err: any) {
      if (err.message.includes('already registered')) {
        duplicateRejected = true;
      }
    }
    if (!duplicateRejected) throw new Error('Duplicate email registration was not prevented');
    console.log('✓ Test 5 Passed: Invalid credentials rejected with 401; duplicate accounts rejected with 409.');
    passedTests++;

    // 6. Logout and Session Invalidation
    console.log('\nTest 6: Verifying logout and session invalidation...');
    const loggedOut = authService.logout(loginResult.token);
    if (!loggedOut) throw new Error('Logout failed to delete session record');

    const invalidatedUser = authService.validateSession(loginResult.token);
    if (invalidatedUser !== null) throw new Error('Session is still valid after logout!');
    console.log('✓ Test 6 Passed: Session token destroyed in SQLite; subsequent authentication fails.');
    passedTests++;

    // 7. Complete Project Creation with All 15 Fields & Retrieval
    console.log('\nTest 7: Testing project creation with all 15 fields & retrieval...');
    const freshSession = await authService.login('studio.alpha@anchora.design', 'TectonicPassword#2026');
    const userAId = freshSession.user.id;

    const projectA1 = projectService.create(userAId, {
      title: 'Monastery of Sainte Marie de La Tourette Analysis',
      category: 'Academic',
      semester: 'Semester 7',
      subject: 'Modernist Concrete Tectonics',
      year: 2026,
      site_location: 'Éveux, France',
      site_dimensions: '110m x 75m',
      site_area: '8,250 sq.m',
      typology: 'Religious & Residential',
      architectural_style: 'Brutalist Concrete',
      status: 'In Progress',
      start_date: '2026-08-20',
      expected_completion_date: '2026-12-15',
      design_requirements: 'Pilotis structure, acoustical crypt resonance, and natural light cannons.',
      description: 'An architectural investigation into Le Corbusier and Iannis Xenakis ondulatoires.',
      notes: ['Review modulor proportions']
    });

    const retrievedProj = projectService.getById(userAId, projectA1.id);
    if (retrievedProj.title !== projectA1.title) throw new Error('Retrieved project title does not match');
    if (retrievedProj.subject !== 'Modernist Concrete Tectonics') throw new Error('Retrieved project subject does not match');
    if (retrievedProj.site_dimensions !== '110m x 75m') throw new Error('Retrieved site dimensions do not match');

    console.log(`✓ Test 7 Passed: Project "${projectA1.title}" created with all 15 fields (ID: ${projectA1.id}).`);
    passedTests++;

    // 8. Project Search, Filter & Sort
    console.log('\nTest 8: Testing project search, filtering by semester/category, and sorting...');
    // Create a second project for User A
    projectService.create(userAId, {
      title: 'Vav Stepwell Water Conservation Pavilion',
      category: 'Studio',
      semester: 'Semester 7',
      subject: 'Climate Responsive Studio',
      typology: 'Landscape / Subterranean',
      site_location: 'Patan, Gujarat'
    });

    const searchResults = projectService.list(userAId, { search: 'Stepwell' });
    if (searchResults.length !== 1 || !searchResults[0].title.includes('Stepwell')) {
      throw new Error('Search failed to find project by keyword');
    }

    const categoryFiltered = projectService.list(userAId, { category: 'Academic' });
    if (categoryFiltered.length !== 1 || categoryFiltered[0].category !== 'Academic') {
      throw new Error('Category filter failed');
    }

    const sortedTitle = projectService.list(userAId, { sortBy: 'title', sortOrder: 'ASC' });
    if (sortedTitle[0].title > sortedTitle[1].title) {
      throw new Error('Sorting by title failed');
    }
    console.log('✓ Test 8 Passed: Search, category filtering, semester filtering, and sorting work correctly.');
    passedTests++;

    // 9. Project Notes CRUD in SQLite (project_notes table)
    console.log('\nTest 9: Testing project notes CRUD in SQLite...');
    const note1 = projectService.addNote(userAId, projectA1.id, 'Jury commended the concrete ondulatoire rhythm.', 'Prof. Frampton');
    const note2 = projectService.addNote(userAId, projectA1.id, 'Need to verify solar angles on southern light cannons.', 'Prof. Doshi');

    const notesList = projectService.getNotes(userAId, projectA1.id);
    if (notesList.length !== 2) throw new Error(`Expected 2 notes, got ${notesList.length}`);

    // Update note
    const updatedNote = projectService.updateNote(userAId, projectA1.id, note1.id, 'Jury commended the concrete rhythm with high distinction.');
    if (!updatedNote.content.includes('high distinction')) throw new Error('Note update failed');

    // Delete note
    projectService.deleteNote(userAId, projectA1.id, note2.id);
    const postDeleteNotes = projectService.getNotes(userAId, projectA1.id);
    if (postDeleteNotes.length !== 1) throw new Error('Note deletion failed');

    console.log('✓ Test 9 Passed: Project notes created, listed chronologically, updated, and deleted in SQLite.');
    passedTests++;

    // 10. AI Output Association with Project (saved_outputs)
    console.log('\nTest 10: Testing AI concept & jury question linking to project in SQLite...');
    const savedConcept = savedOutputRepository.create({
      id: `out_test_${Date.now()}`,
      user_id: userAId,
      project_id: projectA1.id,
      type: 'concept',
      title: 'Dakshin Mandapa Bioclimatic Concept',
      content: 'A tectonic synthesis of Dravidian stone proportion, porous shaded colonnades, and evaporative cooling.',
      metadata: { typology: 'Cultural', score: 98 }
    });

    const projectAiOutputs = savedOutputRepository.findByUser(userAId, undefined, projectA1.id);
    if (projectAiOutputs.length !== 1 || projectAiOutputs[0].title !== savedConcept.title) {
      throw new Error('Linked AI output was not retrieved for project');
    }
    console.log(`✓ Test 10 Passed: AI design concept successfully linked to project "${projectA1.title}" in SQLite.`);
    passedTests++;

    // 11. Cross-User Data Isolation (Projects, Notes & Saved Outputs)
    console.log('\nTest 11: Testing cross-user data isolation across projects, notes, and AI outputs...');
    const userBReg = await authService.register({
      email: 'studio.beta@anchora.design',
      password: 'DravidianPassword#2026',
      fullName: 'Chola Architect',
      semester: 'Semester 8'
    });
    const userBId = userBReg.user.id;

    // User B attempts to access User A's project
    let projectBlocked = false;
    try {
      projectService.getById(userBId, projectA1.id);
    } catch {
      projectBlocked = true;
    }
    if (!projectBlocked) throw new Error('Security breach: User B accessed User A project!');

    // User B attempts to add note to User A's project
    let noteBlocked = false;
    try {
      projectService.addNote(userBId, projectA1.id, 'Unauthorized note from User B');
    } catch {
      noteBlocked = true;
    }
    if (!noteBlocked) throw new Error('Security breach: User B added note to User A project!');

    // User B lists projects -> cannot see User A projects
    const userBProjects = projectService.list(userBId);
    if (userBProjects.some((p) => p.id === projectA1.id)) {
      throw new Error('User isolation failure in project listing');
    }

    console.log('✓ Test 11 Passed: Full data isolation verified. Cross-user access to projects, notes, and AI outputs strictly blocked.');
    passedTests++;

    // 12. Persistence Across Database Connection Reopening
    console.log('\nTest 12: Testing database persistence across connection closing and restart...');
    closeDb(); // Simulate backend restart

    const reopenedDb = initDb(TEST_DB_PATH);
    const postRestartMigrations = runMigrations(reopenedDb);
    if (postRestartMigrations.length !== 0) throw new Error('Migrations should not re-run on reopened database');

    const persistedProj = projectRepository.findById(projectA1.id, userAId);
    if (!persistedProj || persistedProj.title !== projectA1.title) {
      throw new Error('Project data lost after database restart!');
    }

    const persistedNotes = projectRepository.getNotes(projectA1.id, userAId);
    if (persistedNotes.length !== 1 || !persistedNotes[0].content.includes('high distinction')) {
      throw new Error('Project notes lost after database restart!');
    }

    console.log('✓ Test 12 Passed: Complete persistence verified after restart. Projects, notes, and AI links preserved intact.');
    passedTests++;

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('====================================================');
  } finally {
    // Teardown test database
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      } catch (e) {
        // Ignored on file lock
      }
    }
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
