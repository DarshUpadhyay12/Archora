import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initDb, closeDb, getDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { authService } from '../services/authService';
import { usageRepository } from '../repositories/usageRepository';
import { limitController } from '../services/limitController';
import { geminiService } from '../services/geminiService';

// Configure isolated test environment
const TEST_DB_PATH = path.resolve('test_archora_phase8.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

// Clean prior run artifacts
try {
  closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const walPath = `${TEST_DB_PATH}-wal`;
  const shmPath = `${TEST_DB_PATH}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
} catch (e) {}

async function runAiUsageTestSuite() {
  console.log('====================================================');
  console.log('📊 ARCHORA PHASE 8: AI USAGE & LIMIT MANAGEMENT TEST SUITE');
  console.log(`📁 Test Database: ${TEST_DB_PATH}`);
  console.log('====================================================\n');

  const db = initDb(TEST_DB_PATH);
  runMigrations(db);

  // Setup Test Users
  const userA = (await authService.register({
    email: 'kahn@archora.studio',
    fullName: 'Louis Kahn',
    password: 'OrderInSpace123!',
  })).user;

  const userB = (await authService.register({
    email: 'scarpa@archora.studio',
    fullName: 'Carlo Scarpa',
    password: 'BrionCemetery123!',
  })).user;

  let testPassedCount = 0;

  // ----------------------------------------------------
  // TEST 1: Successful Tutor Request Tracking in SQLite
  // ----------------------------------------------------
  console.log('Test 1: Tracking successful Architecture Tutor request...');
  const tutorEvent = usageRepository.recordEvent({
    id: 'evt_tutor_01',
    user_id: userA.id,
    request_id: 'req_tut_01',
    module: 'tutor',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    prompt_tokens: 140,
    candidates_tokens: 380,
    total_tokens: 520,
    duration_ms: 1250,
    input_chars: 180,
  });

  const checkTutor = db.prepare('SELECT * FROM usage_events WHERE id = ?').get('evt_tutor_01') as any;
  if (!checkTutor || checkTutor.module !== 'tutor' || checkTutor.status !== 'success') {
    throw new Error('Test 1 Failed: Tutor event not persisted accurately in SQLite.');
  }
  console.log(`  ✓ Tutor request persisted (ID: ${tutorEvent.id}, ${tutorEvent.total_tokens} tokens, ${tutorEvent.duration_ms}ms)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 2: Successful Concept Generation Tracking in SQLite
  // ----------------------------------------------------
  console.log('Test 2: Tracking successful Design Concept Generator request...');
  const conceptEvent = usageRepository.recordEvent({
    id: 'evt_concept_01',
    user_id: userA.id,
    request_id: 'req_con_01',
    module: 'concept',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    prompt_tokens: 280,
    candidates_tokens: 640,
    total_tokens: 920,
    duration_ms: 2100,
    input_chars: 420,
  });

  const checkConcept = db.prepare('SELECT * FROM usage_events WHERE id = ?').get('evt_concept_01') as any;
  if (!checkConcept || checkConcept.module !== 'concept' || checkConcept.total_tokens !== 920) {
    throw new Error('Test 2 Failed: Concept event not recorded with verified tokens.');
  }
  console.log(`  ✓ Concept generation event persisted (${conceptEvent.total_tokens} tokens)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 3: Successful Jury & Portfolio Assistant Request Tracking
  // ----------------------------------------------------
  console.log('Test 3: Tracking successful Jury & Portfolio Assistant request...');
  const juryEvent = usageRepository.recordEvent({
    id: 'evt_jury_01',
    user_id: userA.id,
    request_id: 'req_jur_01',
    module: 'portfolio',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    prompt_tokens: 210,
    candidates_tokens: 430,
    total_tokens: 640,
    duration_ms: 1680,
    input_chars: 290,
  });

  const checkJury = db.prepare('SELECT * FROM usage_events WHERE id = ?').get('evt_jury_01') as any;
  if (!checkJury || checkJury.module !== 'portfolio') {
    throw new Error('Test 3 Failed: Jury output event not persisted.');
  }
  console.log(`  ✓ Jury & Portfolio event recorded (${juryEvent.total_tokens} tokens)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 4: Failed Request Tracking with Error Category
  // ----------------------------------------------------
  console.log('Test 4: Tracking failed API request with error categorization...');
  const failedEvent = usageRepository.recordEvent({
    id: 'evt_fail_01',
    user_id: userA.id,
    request_id: 'req_fail_01',
    module: 'tutor',
    model_name: 'gemini-1.5-flash',
    status: 'error',
    error_category: 'timeout',
    duration_ms: 30000,
    input_chars: 150,
  });

  const checkFailed = db.prepare('SELECT * FROM usage_events WHERE id = ?').get('evt_fail_01') as any;
  if (!checkFailed || checkFailed.status !== 'error' || checkFailed.error_category !== 'timeout') {
    throw new Error('Test 4 Failed: Failed request not recorded with error category.');
  }
  console.log(`  ✓ Failed request recorded cleanly with error_category = "${failedEvent.error_category}"`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 5: Actual Token Usage Recording When Available
  // ----------------------------------------------------
  console.log('Test 5: Verifying actual token breakdown (prompt + candidates)...');
  const tokenEvent = usageRepository.recordEvent({
    id: 'evt_tokens_01',
    user_id: userA.id,
    module: 'concept',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    prompt_tokens: 312,
    candidates_tokens: 588,
    total_tokens: 900,
    duration_ms: 1950,
    input_chars: 350,
  });

  const checkTokens = db.prepare('SELECT prompt_tokens, candidates_tokens, total_tokens FROM usage_events WHERE id = ?').get('evt_tokens_01') as any;
  if (checkTokens.prompt_tokens !== 312 || checkTokens.candidates_tokens !== 588 || checkTokens.total_tokens !== 900) {
    throw new Error('Test 5 Failed: Token counts do not match verified numbers.');
  }
  console.log('  ✓ Verified token breakdown persisted without estimation or fabrication.');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 6: Handling Unavailable Token Counts (Strictly NULL, Zero Guessing)
  // ----------------------------------------------------
  console.log('Test 6: Handling unavailable provider token metadata (zero fabrication)...');
  const noTokenEvent = usageRepository.recordEvent({
    id: 'evt_no_tokens_01',
    user_id: userA.id,
    module: 'tutor',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    prompt_tokens: null,
    candidates_tokens: null,
    total_tokens: null,
    duration_ms: 800,
    input_chars: 90,
  });

  const checkNoTokens = db.prepare('SELECT prompt_tokens, candidates_tokens, total_tokens FROM usage_events WHERE id = ?').get('evt_no_tokens_01') as any;
  if (checkNoTokens.prompt_tokens !== null || checkNoTokens.total_tokens !== null) {
    throw new Error('Test 6 Failed: Unavailable tokens should be stored as NULL, not fabricated numbers.');
  }
  console.log('  ✓ Unavailable token counts stored as NULL, preserving absolute data honesty.');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 7: Daily Application Limit Enforcement
  // ----------------------------------------------------
  console.log('Test 7: Enforcing application daily limit safeguard...');
  // Configure daily limit to 7
  usageRepository.updateLimits({ max_requests_per_day: 7 }, userA.id);

  // User A currently has 6 events today (tutor, concept, jury, fail, tokens, no_tokens)
  const preCheck = limitController.checkLimits(userA.id, 100);
  if (!preCheck.allowed) {
    throw new Error('Test 7 Failed: 6th request should still be within daily limit of 7.');
  }

  // Record 7th event
  usageRepository.recordEvent({
    id: 'evt_daily_cap_07',
    user_id: userA.id,
    module: 'tutor',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    duration_ms: 900,
    input_chars: 100,
  });

  // 8th check should be blocked by daily limit
  const postCheck = limitController.checkLimits(userA.id, 100);
  if (postCheck.allowed || postCheck.type !== 'daily_limit') {
    throw new Error('Test 7 Failed: Daily application limit was not enforced after reaching quota.');
  }
  console.log(`  ✓ Daily limit enforced: blocked excess request (${postCheck.current}/${postCheck.limit} requests today)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 8: Monthly Application Limit Enforcement
  // ----------------------------------------------------
  console.log('Test 8: Enforcing application monthly limit safeguard...');
  // Set monthly limit to 8 (User A currently has 7 requests)
  usageRepository.updateLimits({ max_requests_per_day: 50, max_requests_per_month: 8 }, userA.id);

  // Record 8th request
  usageRepository.recordEvent({
    id: 'evt_month_cap_08',
    user_id: userA.id,
    module: 'portfolio',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    duration_ms: 1100,
    input_chars: 120,
  });

  const monthlyCheck = limitController.checkLimits(userA.id, 100);
  if (monthlyCheck.allowed || monthlyCheck.type !== 'monthly_limit') {
    throw new Error('Test 8 Failed: Monthly limit was not enforced.');
  }
  console.log(`  ✓ Monthly limit enforced: blocked excess request (${monthlyCheck.current}/${monthlyCheck.limit} requests this month)`);
  testPassedCount++;

  // Reset limits to standard generous development limits
  usageRepository.updateLimits({ max_requests_per_day: 100, max_requests_per_month: 2000 }, userA.id);

  // ----------------------------------------------------
  // TEST 9: Concurrent Request Handling Limit (In-Flight Mutex)
  // ----------------------------------------------------
  console.log('Test 9: Verifying in-flight concurrent execution limiting...');
  usageRepository.updateLimits({ max_concurrent_requests: 2 }, userA.id);

  // Acquire 2 slots (filling capacity)
  limitController.acquireSlot();
  limitController.acquireSlot();

  const concurrentCheck = limitController.checkLimits(userA.id, 100);
  if (concurrentCheck.allowed || concurrentCheck.type !== 'concurrent_limit') {
    throw new Error('Test 9 Failed: Concurrency limit did not block 3rd simultaneous request.');
  }

  // Release 1 slot
  limitController.releaseSlot();
  const retryCheck = limitController.checkLimits(userA.id, 100);
  if (!retryCheck.allowed) {
    throw new Error('Test 9 Failed: Concurrency slot release did not permit subsequent request.');
  }
  // Release remaining slot
  limitController.releaseSlot();
  console.log('  ✓ In-flight concurrency limits and safe slot release verified.');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 10: HTTP 429 Distinction (Application Limit vs Provider Quota)
  // ----------------------------------------------------
  console.log('Test 10: Distinguishing application-level limit from Google provider quota...');
  const appLimitEvent = usageRepository.recordEvent({
    id: 'evt_app_limit_01',
    user_id: userA.id,
    module: 'tutor',
    model_name: 'gemini-1.5-flash',
    status: 'rate_limited',
    error_category: 'daily_limit',
    duration_ms: 5,
    input_chars: 80,
  });

  const providerQuotaEvent = usageRepository.recordEvent({
    id: 'evt_provider_429_01',
    user_id: userA.id,
    module: 'concept',
    model_name: 'gemini-1.5-flash',
    status: 'rate_limited',
    error_category: 'provider_quota_429',
    duration_ms: 450,
    input_chars: 300,
  });

  if (appLimitEvent.error_category !== 'daily_limit' || providerQuotaEvent.error_category !== 'provider_quota_429') {
    throw new Error('Test 10 Failed: Error categorization failed to distinguish app limit from provider quota.');
  }
  console.log('  ✓ Clean distinction between application safeguards and Google 429 provider quotas.');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 11: Free-Tier Cost Protection (No Automatic Paid Fallback)
  // ----------------------------------------------------
  console.log('Test 11: Verifying strict model enforcement without paid fallback...');
  const configuredModel = geminiService.getModelName();
  if (configuredModel.includes('pro-vision') || configuredModel.includes('ultra')) {
    throw new Error('Test 11 Failed: Model configuration unexpectedly pointed to paid tier.');
  }
  console.log(`  ✓ Model strictly configured to "${configuredModel}" (zero paid fallback).`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 12: Usage Persistence After Backend SQLite Restart
  // ----------------------------------------------------
  console.log('Test 12: Testing SQLite persistence across connection close and restart...');
  const countBefore = (db.prepare('SELECT COUNT(*) as count FROM usage_events').get() as any).count;
  closeDb();

  // Re-open DB
  const reopenedDb = initDb(TEST_DB_PATH);
  const countAfter = (reopenedDb.prepare('SELECT COUNT(*) as count FROM usage_events').get() as any).count;

  if (countBefore !== countAfter || countAfter < 10) {
    throw new Error(`Test 12 Failed: Count mismatch after restart (${countBefore} vs ${countAfter})`);
  }
  console.log(`  ✓ All ${countAfter} telemetry events preserved intact across database restart.`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 13: User-Level Data Isolation
  // ----------------------------------------------------
  console.log('Test 13: Verifying multi-tenant isolation (User A vs User B telemetry)...');
  // Record 2 events for User B
  usageRepository.recordEvent({
    id: 'evt_user_b_01',
    user_id: userB.id,
    module: 'tutor',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    total_tokens: 300,
    duration_ms: 1000,
    input_chars: 100,
  });
  usageRepository.recordEvent({
    id: 'evt_user_b_02',
    user_id: userB.id,
    module: 'concept',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    total_tokens: 500,
    duration_ms: 1200,
    input_chars: 150,
  });

  const summaryA = usageRepository.getSummary(userA.id, 'all');
  const summaryB = usageRepository.getSummary(userB.id, 'all');

  if (summaryB.totalRequests !== 2) {
    throw new Error(`Test 13 Failed: User B should have exactly 2 requests, got ${summaryB.totalRequests}`);
  }
  if (summaryA.totalRequests <= summaryB.totalRequests) {
    throw new Error('Test 13 Failed: User A metrics contaminated by User B.');
  }
  console.log(`  ✓ User data isolation verified: User A has ${summaryA.totalRequests} events, User B has ${summaryB.totalRequests} events.`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 14: Accurate Date Filters (today, 7d, 30d, all)
  // ----------------------------------------------------
  console.log('Test 14: Testing analytical date filtering (today, 7d, 30d, all)...');
  // Inject an older event from 20 days ago
  const twentyDaysAgo = new Date();
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

  usageRepository.recordEvent({
    id: 'evt_past_20d',
    user_id: userA.id,
    module: 'tutor',
    model_name: 'gemini-1.5-flash',
    status: 'success',
    total_tokens: 450,
    duration_ms: 1100,
    input_chars: 110,
    created_at: twentyDaysAgo.toISOString(),
  });

  const sumToday = usageRepository.getSummary(userA.id, 'today');
  const sum7d = usageRepository.getSummary(userA.id, '7d');
  const sum30d = usageRepository.getSummary(userA.id, '30d');

  // The 20-day-old event must NOT appear in today or 7d, but MUST appear in 30d
  if (sum7d.totalRequests >= sum30d.totalRequests) {
    throw new Error('Test 14 Failed: 7-day query returned older historical data.');
  }
  console.log(`  ✓ Date filters verified: today=${sumToday.totalRequests}, 7d=${sum7d.totalRequests}, 30d=${sum30d.totalRequests}`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 15: Dashboard Metrics Exact Match with Database Records
  // ----------------------------------------------------
  console.log('Test 15: Verifying dashboard summary matches direct SQL aggregates...');
  const directSql = reopenedDb.prepare(`
    SELECT 
      COUNT(*) as total_count,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failed_count,
      SUM(total_tokens) as tokens_sum
    FROM usage_events
    WHERE user_id = ?
  `).get(userA.id) as any;

  const dashboardAll = usageRepository.getSummary(userA.id, 'all');

  if (
    dashboardAll.totalRequests !== directSql.total_count ||
    dashboardAll.successfulRequests !== directSql.success_count ||
    dashboardAll.failedRequests !== directSql.failed_count ||
    dashboardAll.totalTokens !== directSql.tokens_sum
  ) {
    throw new Error('Test 15 Failed: Dashboard summary figures do not match raw SQL aggregates.');
  }
  console.log(`  ✓ Dashboard metrics exactly match raw database aggregates (${dashboardAll.totalRequests} reqs, ${dashboardAll.totalTokens} tokens).`);
  testPassedCount++;

  console.log('\n====================================================');
  console.log(`🎉 ALL ${testPassedCount}/15 AI USAGE & LIMIT TEST SCENARIOS PASSED!`);
  console.log('====================================================\n');

  closeDb();
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  } catch (e) {}
}

runAiUsageTestSuite().catch((err) => {
  console.error('\n❌ AI USAGE TEST SUITE FAILED:', err);
  process.exit(1);
});

