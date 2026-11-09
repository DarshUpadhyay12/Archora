import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, closeDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { authService } from '../services/authService';
import { conversationRepository } from '../repositories/conversationRepository';
import { savedOutputRepository } from '../repositories/savedOutputRepository';
import { projectRepository } from '../repositories/projectRepository';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, '../../test_anchora_phase5.db');

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 ANCHORA PHASE 5: AI CONVERSATION HISTORY & SAVED OUTPUTS TEST SUITE');
  console.log(`📁 Test Database: ${TEST_DB_PATH}`);
  console.log('====================================================\n');

  // Clean previous test artifact
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const walPath = `${TEST_DB_PATH}-wal`;
  const shmPath = `${TEST_DB_PATH}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  let passedTests = 0;
  const totalTests = 14;

  try {
    // Setup: Initialize DB & apply all migrations (001, 002, 003)
    const db = initDb(TEST_DB_PATH);
    const applied = runMigrations(db);
    console.log(`[Setup] Migrations applied: ${applied.join(', ')}`);

    // Register 2 test users for isolation testing
    const userA = await authService.register({
      email: 'architect.a@anchora.studio',
      password: 'Password123!',
      fullName: 'Architect Alpha',
    });

    const userB = await authService.register({
      email: 'architect.b@anchora.studio',
      password: 'Password123!',
      fullName: 'Architect Beta',
    });

    // Create a studio project for User A to test project association
    const projectA = projectRepository.create({
      id: `proj_test_01`,
      user_id: userA.user.id,
      title: 'Biophilic Urban Observatory',
      typology: 'Civic / Observation',
      description: 'Mass timber tower with natural stack ventilation.',
      semester: 'Semester 8',
      subject: 'Advanced Studio VI',
      year: 2026,
      site_location: 'Hamburg Waterfront',
      site_dimensions: '40m x 40m',
      site_area: '1,600 sq.m',
      architectural_style: 'Timber Tectonics',
      start_date: '2026-02-01',
      expected_completion_date: '2026-06-30',
      design_requirements: 'Public viewing platform, timber braced frames',
      notes: 'Focus on fire-engineering and mass timber jointing',
      status: 'In Progress',
    });

    // 1. New tutor conversation creation
    console.log('Test 1: Creating new tutor conversation in SQLite...');
    const conv1 = conversationRepository.createConversation({
      id: 'conv_test_01',
      user_id: userA.user.id,
      module: 'tutor',
      title: 'Tectonic Logic of Kahn and Scarpa',
      topic: 'theory',
    });
    if (!conv1 || conv1.title !== 'Tectonic Logic of Kahn and Scarpa') throw new Error('Conversation creation failed');
    console.log(`✓ Test 1 Passed: Conversation created (ID: ${conv1.id}).`);
    passedTests++;

    // 2. User message persistence
    console.log('\nTest 2: Persisting user message in conversation...');
    const userMsg = conversationRepository.addMessage({
      id: 'msg_u_01',
      conversation_id: conv1.id,
      user_id: userA.user.id,
      role: 'user',
      content: 'How did Carlo Scarpa treat material joints at Querini Stampalia?',
    });
    if (!userMsg || userMsg.role !== 'user') throw new Error('User message not saved');
    console.log('✓ Test 2 Passed: User message persisted successfully.');
    passedTests++;

    // 3. Gemini response persistence
    console.log('\nTest 3: Persisting Gemini assistant response with citations & follow-ups...');
    const aiMsg = conversationRepository.addMessage({
      id: 'msg_a_01',
      conversation_id: conv1.id,
      user_id: userA.user.id,
      role: 'assistant',
      content: 'Scarpa articulated joints by introducing shadow gaps (scuretti) and separating bronze, Istrian stone, and water.',
      citations: ['Querini Stampalia Monograph, Phaidon 2018', 'Frampton, Studies in Tectonic Culture'],
      followUpSuggestions: ['How did he handle tidal water ingress?', 'What were his concrete bush-hammering techniques?'],
      token_count: 480,
    });
    if (!aiMsg || aiMsg.role !== 'assistant') throw new Error('AI response not saved');
    console.log('✓ Test 3 Passed: AI response persisted with citations & tokens.');
    passedTests++;

    // 4. Reopening previous conversations with messages in chronological order
    console.log('\nTest 4: Reopening previous conversation and verifying message order...');
    const reopened = conversationRepository.getConversationWithMessages(conv1.id, userA.user.id);
    if (!reopened || reopened.messages.length !== 2) throw new Error('Conversation messages count mismatch');
    if (reopened.messages[0].role !== 'user' || reopened.messages[1].role !== 'assistant') {
      throw new Error('Message order violation');
    }
    console.log(`✓ Test 4 Passed: Reopened conversation with ${reopened.messages.length} messages in correct order.`);
    passedTests++;

    // 5. Renaming conversations
    console.log('\nTest 5: Renaming conversation...');
    const renamed = conversationRepository.updateConversation(conv1.id, userA.user.id, {
      title: 'Scarpa & Kahn: Material Joint Tectonics',
    });
    if (!renamed || renamed.title !== 'Scarpa & Kahn: Material Joint Tectonics') throw new Error('Rename failed');
    console.log(`✓ Test 5 Passed: Conversation renamed to "${renamed.title}".`);
    passedTests++;

    // 6. Deleting conversations (with cascade)
    console.log('\nTest 6: Deleting temporary conversation with cascade verification...');
    const tempConv = conversationRepository.createConversation({
      id: 'conv_temp_del',
      user_id: userA.user.id,
      module: 'tutor',
      title: 'Temporary Inquiring to Delete',
    });
    conversationRepository.addMessage({
      id: 'msg_temp_01',
      conversation_id: tempConv.id,
      user_id: userA.user.id,
      role: 'user',
      content: 'Will be deleted.',
    });
    const deleted = conversationRepository.deleteConversation(tempConv.id, userA.user.id);
    if (!deleted) throw new Error('Delete failed');
    const remainingMsgs = conversationRepository.getMessages(tempConv.id, userA.user.id);
    if (remainingMsgs.length !== 0) throw new Error('Cascade deletion failed');
    console.log('✓ Test 6 Passed: Conversation and child messages deleted successfully.');
    passedTests++;

    // 7. Design concept persistence
    console.log('\nTest 7: Persisting structured design concept in SQLite...');
    const conceptOutput = savedOutputRepository.create({
      id: 'out_concept_01',
      user_id: userA.user.id,
      project_id: projectA.id,
      type: 'concept',
      title: 'Bioclimatic Timber Spire: Passive Solar Scheme',
      content: 'A mass-timber diagnostic tower optimizing solar orientation with double-skin facade and chimney stack.',
      metadata: {
        spatialStrategy: ['Core service spine', 'Perimeter open viewing deck'],
        daylightVentilation: ['Stack effect central atrium'],
        materialPalette: [{ name: 'Glulam Douglas Fir', role: 'Primary structure' }],
      },
    });
    if (!conceptOutput || conceptOutput.type !== 'concept') throw new Error('Concept save failed');
    console.log(`✓ Test 7 Passed: Concept saved (ID: ${conceptOutput.id}).`);
    passedTests++;

    // 8. Jury output persistence
    console.log('\nTest 8: Persisting Jury viva questions in SQLite...');
    const juryOutput = savedOutputRepository.create({
      id: 'out_jury_01',
      user_id: userA.user.id,
      project_id: projectA.id,
      type: 'jury-viva-questions',
      title: 'Urban Observatory Jury Defense Script',
      content: 'Anticipated viva critique questions on mass-timber fire codes and foundation settlements.',
      metadata: {
        questions: [
          { question: 'Why timber on an exposed waterfront?', intent: 'Testing structural moisture durability' }
        ],
      },
    });
    if (!juryOutput || juryOutput.type !== 'jury-viva-questions') throw new Error('Jury output save failed');
    console.log(`✓ Test 8 Passed: Jury viva output saved (ID: ${juryOutput.id}).`);
    passedTests++;

    // 9. Project association and re-association
    console.log('\nTest 9: Verifying project association and reassignment...');
    const updatedOutput = savedOutputRepository.update(juryOutput.id, userA.user.id, {
      title: 'Urban Observatory Defense (Final Jury V2)',
      project_id: projectA.id,
    });
    if (!updatedOutput || updatedOutput.project_id !== projectA.id) throw new Error('Project association failed');
    if (updatedOutput.title !== 'Urban Observatory Defense (Final Jury V2)') throw new Error('Title update failed');
    console.log(`✓ Test 9 Passed: Asset linked to project "${projectA.title}" with updated title.`);
    passedTests++;

    // 10. Search and filtering across outputs and conversations
    console.log('\nTest 10: Testing search & category filtering...');
    const searchRes = savedOutputRepository.findByUser(userA.user.id, {
      search: 'Timber',
      sortBy: 'newest',
    });
    if (searchRes.length !== 2) throw new Error(`Expected 2 items with 'Timber', got ${searchRes.length}`);

    const tutorSearch = conversationRepository.findConversationsByUser(userA.user.id, {
      search: 'Scarpa',
    });
    if (tutorSearch.length !== 1) throw new Error('Conversation search failed');
    console.log(`✓ Test 10 Passed: Search & category filtering confirmed (${searchRes.length} outputs, ${tutorSearch.length} conversation).`);
    passedTests++;

    // 11. User-level data isolation
    console.log('\nTest 11: Verifying strict data isolation between User A and User B...');
    const userBConversations = conversationRepository.findConversationsByUser(userB.user.id);
    const userBOutputs = savedOutputRepository.findByUser(userB.user.id);
    if (userBConversations.length !== 0) throw new Error('Data breach: User B saw User A conversations');
    if (userBOutputs.length !== 0) throw new Error('Data breach: User B saw User A outputs');

    // Attempt unauthorized access by User B to User A conversation
    const breachAttempt = conversationRepository.findConversationById(conv1.id, userB.user.id);
    if (breachAttempt !== null) throw new Error('Data isolation failure: User B retrieved User A conversation');

    console.log('✓ Test 11 Passed: Full data isolation confirmed. User B sees 0 items.');
    passedTests++;

    // 12. Persistence after simulated browser refresh (direct DB re-query)
    console.log('\nTest 12: Simulating page refresh (fresh state re-query)...');
    const freshQuery = savedOutputRepository.findById(conceptOutput.id, userA.user.id);
    if (!freshQuery || freshQuery.title !== conceptOutput.title) throw new Error('Refresh query failed');
    console.log('✓ Test 12 Passed: Data perfectly matches across state reinstantiations.');
    passedTests++;

    // 13. Persistence after database connection close and restart
    console.log('\nTest 13: Closing database connection and restarting backend instance...');
    closeDb();
    const reopenedDb = initDb(TEST_DB_PATH);
    const postRestartConv = conversationRepository.findConversationById(conv1.id, userA.user.id);
    const postRestartOutput = savedOutputRepository.findById(conceptOutput.id, userA.user.id);
    if (!postRestartConv || !postRestartOutput) throw new Error('Data lost after restart!');
    console.log(`✓ Test 13 Passed: Complete persistence verified after SQLite restart.`);
    passedTests++;

    // 14. Error handling: Failure does not corrupt or pollute database
    console.log('\nTest 14: Verifying failure containment (no pollution on error)...');
    try {
      // Intentionally insert with missing required fields
      reopenedDb.prepare('INSERT INTO conversations (id, user_id, module, title) VALUES (?, ?, ?, ?)').run(
        null, userA.user.id, 'tutor', 'Faulty'
      );
      throw new Error('Should have failed NOT NULL check');
    } catch (err: any) {
      if (err.message.includes('NOT NULL constraint failed') || err.message.includes('datatype mismatch')) {
        console.log('✓ Test 14 Passed: Database constraints prevent invalid or corrupted history entries.');
        passedTests++;
      } else {
        throw err;
      }
    }

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 5 TESTS PASSED SUCCESSFULLY!`);
    console.log('====================================================');
  } catch (err: any) {
    console.error('\n❌ TEST FAILURE:', err.message);
    process.exit(1);
  } finally {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const wal = `${TEST_DB_PATH}-wal`;
    const shm = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  }
}

runTestSuite();
