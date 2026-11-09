/**
 * ARCHORA VASTUVISION INTEGRATION & VERIFICATION TEST SUITE
 * 
 * Tests:
 * 1. Database schema migration 010 (vastu_analyses, vastu_knowledge_rules)
 * 2. Deterministic directional mapping & North angle offset rotation
 * 3. Classical canon rule matching (Manasara, Mayamata, Brihat Samhita)
 * 4. Multi-tenant data isolation for saved Vastu analyses
 * 5. Architectural PDF report generation for Vastu assessments
 * 6. Non-dogmatic disclaimer and cultural responsibility enforcement
 */

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrator';
import { vastuService } from '../services/vastuService';
import { vastuRepository } from '../repositories/vastuRepository';
import { generateVastuReportPdf } from '../services/pdfGeneratorService';
import { VASTU_RULES_CATALOG, VASTU_DIRECTIONS } from '../services/vastuKnowledgeBase';

const TEST_DB_PATH = path.resolve(process.cwd(), 'test_archora_vastuvision.db');

function cleanupDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch {
      // ignore
    }
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧭 ARCHORA: VASTUVISION SYSTEM VERIFICATION SUITE');
  console.log(`📁 Test Database: ${TEST_DB_PATH}`);
  console.log('====================================================\n');

  cleanupDb();
  process.env.DATABASE_PATH = TEST_DB_PATH;

  let db: Database.Database;

  try {
    // ----------------------------------------------------
    // TEST 1: Database Migration 010 Execution
    // ----------------------------------------------------
    console.log('Test 1: Executing schema migration 010 (VastuVision tables)...');
    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const applied = runMigrations(db);
    if (!applied.includes('010_vastuvision.sql')) {
      throw new Error(`Migration 010_vastuvision.sql not applied. Applied list: ${applied.join(', ')}`);
    }

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    if (!tableNames.includes('vastu_analyses') || !tableNames.includes('vastu_knowledge_rules')) {
      throw new Error(`Expected tables missing. Existing: ${tableNames.join(', ')}`);
    }
    console.log('✓ Test 1 Passed: Migration 010 executed. Tables `vastu_analyses` and `vastu_knowledge_rules` created.\n');

    // ----------------------------------------------------
    // TEST 2: Knowledge Base Seeding & Authenticity Audit
    // ----------------------------------------------------
    console.log('Test 2: Auditing authentic classical Vastu knowledge rules...');
    vastuRepository.seedRulesIfEmpty();
    const rules = vastuRepository.getRules();
    if (rules.length < 10) {
      throw new Error(`Insufficient rules seeded: ${rules.length}`);
    }

    const traditions = new Set(rules.map((r) => r.tradition));
    if (!traditions.has('Manasara') || !traditions.has('Mayamata') || !traditions.has('Brihat Samhita')) {
      throw new Error(`Missing expected classical traditions in catalog: ${Array.from(traditions).join(', ')}`);
    }

    // Verify all rules have environmental/architectural rationales
    for (const rule of rules) {
      if (!rule.architectural_rationale || !rule.source_reference) {
        throw new Error(`Rule ${rule.rule_id} lacks source reference or architectural rationale.`);
      }
    }
    console.log(`✓ Test 2 Passed: ${rules.length} authenticated classical rules verified across ${traditions.size} canons.\n`);

    // ----------------------------------------------------
    // TEST 3: Deterministic Directional Coordinate Calculation
    // ----------------------------------------------------
    console.log('Test 3: Testing deterministic spatial directional mapping...');
    // Center point (0.5, 0.5) -> Center (Brahmasthan)
    const centerRes = vastuService.calculateDirection(0.5, 0.5, 0);
    if (centerRes.direction !== 'Center') {
      throw new Error(`Center point miscalculated: expected Center, got ${centerRes.direction}`);
    }

    // Top center (0.5, 0.05) with North = 0° -> North
    const northRes = vastuService.calculateDirection(0.5, 0.05, 0);
    if (northRes.direction !== 'North') {
      throw new Error(`Top point miscalculated: expected North, got ${northRes.direction}`);
    }

    // Bottom-left (0.1, 0.9) with North = 0° -> South-West (Nairutya)
    const swRes = vastuService.calculateDirection(0.1, 0.9, 0);
    if (swRes.direction !== 'South-West') {
      throw new Error(`Bottom-left point miscalculated: expected South-West, got ${swRes.direction}`);
    }

    // Bottom-right (0.9, 0.9) with North = 0° -> South-East (Agneya)
    const seRes = vastuService.calculateDirection(0.9, 0.9, 0);
    if (seRes.direction !== 'South-East') {
      throw new Error(`Bottom-right point miscalculated: expected South-East, got ${seRes.direction}`);
    }

    // Geographic North Rotation: if North is at 90° (East is up), then top center should map to West!
    const rotatedRes = vastuService.calculateDirection(0.5, 0.05, 90);
    if (rotatedRes.direction !== 'West') {
      throw new Error(`Rotated geographic north failed: expected West, got ${rotatedRes.direction}`);
    }
    console.log('✓ Test 3 Passed: Deterministic coordinate-to-azimuth mapping and geographic north rotation verified.\n');

    // ----------------------------------------------------
    // TEST 4: Rule Engine Concordance Evaluation
    // ----------------------------------------------------
    console.log('Test 4: Testing canonical room evaluation concordance...');
    const testRooms = [
      { id: 'r1', name: 'Main Entrance Gate', spaceType: 'Main entrance', direction: 'North-East' },
      { id: 'r2', name: 'Primary Culinary Kitchen', spaceType: 'Kitchen', direction: 'South-East' },
      { id: 'r3', name: 'Head Master Bedroom', spaceType: 'Master bedroom', direction: 'South-West' },
      { id: 'r4', name: 'Sanctuary Meditation Room', spaceType: 'Prayer room', direction: 'North-East' },
      { id: 'r5', name: 'Deviant Toilet Placement', spaceType: 'Bathroom', direction: 'North-East' }, // Should be deviation!
    ];

    const evalResult = vastuService.evaluateLayout(testRooms, 0, 'Residential', 'Manasara');

    if (evalResult.totalRooms !== 5) {
      throw new Error(`Expected 5 evaluated rooms, got ${evalResult.totalRooms}`);
    }
    if (evalResult.matchesCount !== 4) {
      throw new Error(`Expected 4 matches, got ${evalResult.matchesCount}`);
    }
    if (evalResult.deviationsCount !== 1) {
      throw new Error(`Expected 1 deviation, got ${evalResult.deviationsCount}`);
    }

    const toiletEval = evalResult.roomEvaluations.find((r) => r.roomId === 'r5');
    if (!toiletEval || toiletEval.status !== 'Potential deviation') {
      throw new Error(`Toilet in North-East should be flagged as "Potential deviation", got ${toiletEval?.status}`);
    }

    // Check responsibility disclaimer
    if (!evalResult.disclaimer || !evalResult.disclaimer.includes('Modern building codes')) {
      throw new Error('Required cultural responsibility and building code disclaimer is missing.');
    }
    console.log(`✓ Test 4 Passed: Concordance accurately scored (${evalResult.alignmentScore}%). Canonical deviation properly flagged.\n`);

    // ----------------------------------------------------
    // TEST 5: SQLite CRUD & Multi-Tenant Data Isolation
    // ----------------------------------------------------
    console.log('Test 5: Testing multi-tenant SQLite persistence & isolation...');
    // Create mock users
    db.prepare("INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at) VALUES ('usr_a', 'Architect Alpha', 'alpha@archora.io', 'hash', '2026-01-01', '2026-01-01')").run();
    db.prepare("INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at) VALUES ('usr_b', 'Architect Beta', 'beta@archora.io', 'hash', '2026-01-01', '2026-01-01')").run();

    const analysisA = vastuRepository.create({
      id: 'analysis_001',
      user_id: 'usr_a',
      title: 'Solar Courtyard Villa Vastu Assessment',
      building_type: 'Residential',
      geographic_north_degrees: 15.0,
      rooms: testRooms,
      results: evalResult,
      summary: 'Optimal residential orientation with Agni quadrant kitchen.',
      tradition: 'Manasara',
    });

    if (analysisA.id !== 'analysis_001') {
      throw new Error('Failed to create analysis for User A.');
    }

    // Verify User A can fetch it
    const fetchedA = vastuRepository.findById('analysis_001', 'usr_a');
    if (!fetchedA) {
      throw new Error('User A could not retrieve own analysis.');
    }

    // Verify User B CANNOT fetch it (Data Isolation)
    const fetchedB = vastuRepository.findById('analysis_001', 'usr_b');
    if (fetchedB !== null) {
      throw new Error('CRITICAL SECURITY VIOLATION: User B accessed User A’s Vastu analysis!');
    }

    // Update analysis
    const updated = vastuRepository.update('analysis_001', 'usr_a', {
      title: 'Updated Villa Assessment',
    });
    if (updated?.title !== 'Updated Villa Assessment') {
      throw new Error('Failed to update analysis title.');
    }

    // Delete analysis
    const deleted = vastuRepository.delete('analysis_001', 'usr_a');
    if (!deleted || vastuRepository.findById('analysis_001', 'usr_a') !== null) {
      throw new Error('Failed to delete analysis.');
    }
    console.log('✓ Test 5 Passed: SQLite CRUD and strict multi-tenant user data isolation confirmed.\n');

    // ----------------------------------------------------
    // TEST 6: Authentic Vastu PDF Vector Generation
    // ----------------------------------------------------
    console.log('Test 6: Generating genuine architectural Vastu PDF document...');
    const pdfBuffer = await generateVastuReportPdf({
      title: 'VastuVision Academic Spatial Assessment',
      building_type: 'Residential Villa',
      tradition: 'Manasara',
      geographic_north_degrees: 22.5,
      results_json: JSON.stringify(evalResult),
      rooms_json: JSON.stringify(testRooms),
      summary: 'The spatial configuration aligns with solar thermal zoning across cardinal axes.',
    });

    if (!pdfBuffer || pdfBuffer.length < 2000) {
      throw new Error(`Generated PDF buffer is too small: ${pdfBuffer ? pdfBuffer.length : 0} bytes`);
    }

    const header = pdfBuffer.slice(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error(`Invalid PDF header: expected %PDF-, got ${header}`);
    }
    console.log(`✓ Test 6 Passed: Authentic architectural PDF generated (${pdfBuffer.length} bytes, header: ${header}).\n`);

    console.log('====================================================');
    console.log('🎉 ALL 6/6 VASTUVISION INTEGRATION TESTS PASSED!');
    console.log('====================================================\n');
  } finally {
    if (db!) {
      db.close();
    }
    cleanupDb();
  }
}

runTestSuite().catch((err) => {
  console.error('❌ VASTUVISION TEST FAILURE:', err);
  cleanupDb();
  process.exit(1);
});
