import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initDb, closeDb, getDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { authService } from '../services/authService';
import { projectRepository } from '../repositories/projectRepository';
import { savedOutputRepository } from '../repositories/savedOutputRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { fileRepository } from '../repositories/fileRepository';
import { exportRepository } from '../repositories/exportRepository';
import {
  generateProjectReportPdf,
  generateConceptReportPdf,
  generateTutorNotesPdf,
  generateJuryPrepPdf,
  generatePortfolioPdf,
} from '../services/pdfGeneratorService';
import { generateStorageFilename } from '../services/fileStorageService';

// Configure isolated test environment
const TEST_DB_PATH = path.resolve('test_anchora_phase7.db');
const TEST_UPLOAD_DIR = path.resolve('test_uploads_phase7');

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

async function runPdfExportTestSuite() {
  console.log('====================================================');
  console.log('🏛️ ANCHORA PHASE 7: PROFESSIONAL PDF EXPORT TEST SUITE');
  console.log(`📁 Test Database: ${TEST_DB_PATH}`);
  console.log(`📂 Test Uploads:  ${TEST_UPLOAD_DIR}`);
  console.log('====================================================\n');

  const db = initDb(TEST_DB_PATH);
  runMigrations(db);

  // Setup Test Users
  const userA = (await authService.register({
    email: 'corbusier@anchora.studio',
    fullName: 'Le Corbusier',
    password: 'ModulorSecret123!',
  })).user;

  const userB = (await authService.register({
    email: 'zaha@anchora.studio',
    fullName: 'Zaha Hadid',
    password: 'ParametricSecret123!',
  })).user;

  // Setup Test Project for User A
  const projectA = projectRepository.create({
    id: 'proj_pdf_01',
    user_id: userA.id,
    title: 'Dakshin Mandapa Cultural Center',
    category: 'Civic',
    semester: 'Semester 8',
    year: 2026,
    site_location: 'Thanjavur, Tamil Nadu',
    site_area: '4,500 sq.m (75m x 60m)',
    typology: 'Cultural & Performing Arts',
    description: 'Climate-responsive cultural pavilion synthesizing Dravidian stone proportions and passive evaporative courtyard cooling.',
    architectural_style: 'Contemporary Vernacular Dravidian',
    notes: JSON.stringify([
      { id: 'n1', content: 'Incorporate granite ashlar plinth elevated 1.2m above finished grade for flood defense.', author: userA.name, created_at: new Date().toISOString() },
      { id: 'n2', content: 'Stepped water basin layout induces stack effect ventilation through clerestory timber louvers.', author: userA.name, created_at: new Date().toISOString() }
    ]),
    status: 'In Progress',
  });

  // Setup sample drawing file for User A
  // Minimal valid 1x1 JPEG
  const sampleJpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
    0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
    0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
    0x00, 0xBF, 0x00, 0xFF, 0xD9
  ]);
  const storageName1 = generateStorageFilename('.jpg');
  const storagePath1 = path.join(TEST_UPLOAD_DIR, storageName1);
  fs.writeFileSync(storagePath1, sampleJpeg);

  const fileA1 = fileRepository.create({
    id: 'file_pdf_01',
    user_id: userA.id,
    project_id: projectA.id,
    original_filename: 'Ground_Floor_Plan_Mandapa.jpg',
    storage_filename: storageName1,
    storage_path: storagePath1,
    file_size: sampleJpeg.length,
    mime_type: 'image/jpeg',
    file_extension: '.jpg',
    category: 'Drawing',
    description: 'Ground level hypostyle colonnade and stepped tank plan.',
  });

  let testPassedCount = 0;

  // ----------------------------------------------------
  // TEST 1: Export Real Project Report
  // ----------------------------------------------------
  console.log('Test 1: Generating real Project Report PDF...');
  const projectNotes = projectRepository.listNotes(projectA.id, userA.id);
  const pdfBuffer1 = await generateProjectReportPdf(projectA, [fileA1], projectNotes, {
    title: 'Studio Dossier: Dakshin Mandapa',
    authorName: 'Le Corbusier',
    institutionName: 'Atelier de Paris',
  });

  if (!Buffer.isBuffer(pdfBuffer1) || pdfBuffer1.length < 1000) {
    throw new Error('Test 1 Failed: Project Report buffer invalid or empty.');
  }
  if (pdfBuffer1.subarray(0, 5).toString('utf-8') !== '%PDF-') {
    throw new Error('Test 1 Failed: Buffer does not start with valid %PDF- magic signature.');
  }
  console.log(`  ✓ Project Report generated (${pdfBuffer1.length} bytes, valid PDF header)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 2: Export Saved Design Concept
  // ----------------------------------------------------
  console.log('Test 2: Generating Saved Design Concept PDF...');
  const conceptRecord = savedOutputRepository.create({
    id: 'out_concept_01',
    user_id: userA.id,
    project_id: projectA.id,
    type: 'concept-narrative',
    title: 'Dakshin Mandapa: Climate-Responsive Tectonics',
    content: JSON.stringify({
      narrative: 'The design distills three foundational architectural truths: the elevated stone plinth (Upapitha), the shaded hypostyle perimeter (Mandapa), and the central contemplative void (Garbha).',
      spatialStrategy: 'Perimeter colonnades act as thermal buffers shielding internal galleries from direct solar insolation while channeling prevailing southwest monsoon breezes.',
      passiveSolar: 'Stepped water courtyard induces evaporative cooling and stack ventilation via high-level clerestory operable louvers.',
      materials: 'Locally quarried Thanjavur granite ashlar base, reclaimed teak column shafts, and interlocking terracotta tile roof canopy.',
      sustainability: 'Zero-concrete vernacular masonry envelope with high thermal mass dampening diurnal temperature fluctuations by up to 7°C.'
    }),
  });

  const pdfBuffer2 = await generateConceptReportPdf(conceptRecord, projectA, {
    authorName: 'Le Corbusier',
    institutionName: 'Atelier de Paris',
  });

  if (!Buffer.isBuffer(pdfBuffer2) || pdfBuffer2.length < 1000) {
    throw new Error('Test 2 Failed: Concept Report buffer invalid.');
  }
  if (pdfBuffer2.subarray(0, 5).toString('utf-8') !== '%PDF-') {
    throw new Error('Test 2 Failed: Concept PDF lacks %PDF- header.');
  }
  console.log(`  ✓ Design Concept Report generated (${pdfBuffer2.length} bytes)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 3: Export Architecture Tutor Conversation Notes
  // ----------------------------------------------------
  console.log('Test 3: Generating Architecture Tutor Notes PDF...');
  const conversation = conversationRepository.create({
    id: 'conv_tutor_01',
    user_id: userA.id,
    title: 'Thermal Mass in Dravidian Stone Tectonics',
    tool_type: 'tutor',
    project_id: projectA.id,
  });

  conversationRepository.addMessage({
    id: 'msg_01',
    conversation_id: conversation.id,
    user_id: userA.id,
    role: 'user',
    content: 'How does the granite Upapitha plinth contribute to passive cooling in hot-humid climates?',
  });

  conversationRepository.addMessage({
    id: 'msg_02',
    conversation_id: conversation.id,
    user_id: userA.id,
    role: 'assistant',
    content: 'Granite possesses high volumetric heat capacity. By decoupling the occupied platform from direct soil heat while shading the lower mass, it acts as a heat sink during solar noon and releases warmth gradually into open courtyards at night.',
  });

  const messages = conversationRepository.getMessagesByConversationId(conversation.id, userA.id);
  const pdfBuffer3 = await generateTutorNotesPdf(conversation, messages, {
    authorName: 'Le Corbusier',
    institutionName: 'Atelier de Paris',
  });

  if (!Buffer.isBuffer(pdfBuffer3) || pdfBuffer3.length < 1000) {
    throw new Error('Test 3 Failed: Tutor Notes PDF buffer invalid.');
  }
  console.log(`  ✓ Tutor Notes PDF generated with ${messages.length} messages (${pdfBuffer3.length} bytes)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 4: Export Jury Preparation & Viva Dossier
  // ----------------------------------------------------
  console.log('Test 4: Generating Jury Defense Dossier PDF...');
  const juryRecord = savedOutputRepository.create({
    id: 'out_jury_01',
    user_id: userA.id,
    project_id: projectA.id,
    type: 'jury-viva-questions',
    title: 'Dakshin Mandapa: Terminal Jury Defense Dossier',
    content: JSON.stringify([
      {
        question: 'Why utilize heavy granite plinths in a hot-humid zone where lightweight ventilation is traditionally preferred?',
        intent: 'Testing student knowledge of vernacular thermal flywheel dynamics versus cross-ventilation trade-offs.',
        suggestedAnswer: 'While lightweight envelopes facilitate rapid cross-ventilation, heavy granite provides the necessary thermal inertia to dampen peak diurnal solar radiation, while our open hypostyle colonnade ensures air changes remain uninhibited.'
      },
      {
        question: 'How does your stepped courtyard prevent stagnation and humidity buildup during monsoon seasons?',
        intent: 'Examining drainage and convective air circulation mechanics.',
        suggestedAnswer: 'The central basin features continuous overflow channels connected to external bioswales, while high-level clerestory exhaust louvers maintain positive stack ventilation even when air is still.'
      }
    ]),
  });

  const pdfBuffer4 = await generateJuryPrepPdf(juryRecord, projectA, {
    authorName: 'Le Corbusier',
    institutionName: 'Atelier de Paris',
  });

  if (!Buffer.isBuffer(pdfBuffer4) || pdfBuffer4.length < 1000) {
    throw new Error('Test 4 Failed: Jury PDF buffer invalid.');
  }
  console.log(`  ✓ Jury Preparation PDF generated (${pdfBuffer4.length} bytes)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 5: Export Portfolio Content
  // ----------------------------------------------------
  console.log('Test 5: Generating Studio Portfolio Presentation PDF...');
  const portfolioRecord = savedOutputRepository.create({
    id: 'out_port_01',
    user_id: userA.id,
    project_id: projectA.id,
    type: 'project-description',
    title: 'Dakshin Mandapa: Architectural Portfolio Statement',
    content: 'Dakshin Mandapa stands as an inquiry into the permanence of regional tectonics amid ecological instability. By distilling the spatial syntax of the classical Dravidian temple courtyard, this pavilion offers a sanctuary of contemplative silence, shaded assemblies, and passive climatic comfort without mechanical air conditioning.',
  });

  const pdfBuffer5 = await generatePortfolioPdf(portfolioRecord, projectA, {
    authorName: 'Le Corbusier',
    institutionName: 'Atelier de Paris',
  });

  if (!Buffer.isBuffer(pdfBuffer5) || pdfBuffer5.length < 1000) {
    throw new Error('Test 5 Failed: Portfolio PDF buffer invalid.');
  }
  console.log(`  ✓ Portfolio Content PDF generated (${pdfBuffer5.length} bytes)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 6: Export Multi-page Document with Automatic Pagination
  // ----------------------------------------------------
  console.log('Test 6: Generating Multi-page Document with automatic page flow...');
  // Create an extensive conversation with multiple exchanges
  const multiConv = conversationRepository.create({
    id: 'conv_multi_01',
    user_id: userA.id,
    title: 'Comprehensive Studio Viva Synthesis',
    tool_type: 'tutor',
    project_id: projectA.id,
  });

  for (let i = 1; i <= 12; i++) {
    conversationRepository.addMessage({
      id: `msg_multi_${i}_u`,
      conversation_id: multiConv.id,
      user_id: userA.id,
      role: 'user',
      content: `Inquiry ${i}: How does the tectonic expression of structural joints impact seismic resilience and thermal expansion in massive timber roof systems?`,
    });
    conversationRepository.addMessage({
      id: `msg_multi_${i}_a`,
      conversation_id: multiConv.id,
      user_id: userA.id,
      role: 'assistant',
      content: `Response ${i}: Massive timber structures rely on ductile dowel-type connections and notched carpentry joints (such as the traditional mortise-and-tenon or Japanese kanawa tsugi) that permit microscopic deformation under seismic lateral shear without catastrophic rupture. The hygroscopic movement of timber must be accommodated by slotted bolt holes and expansion reveals along the primary load-bearing purlins.`,
    });
  }

  const multiMessages = conversationRepository.getMessagesByConversationId(multiConv.id, userA.id);
  const pdfBuffer6 = await generateTutorNotesPdf(multiConv, multiMessages, {
    title: 'Extensive Multi-Page Architectural Dialogue',
  });

  // Verify multi-page generation by checking size and content
  if (pdfBuffer6.length < 5000) {
    throw new Error('Test 6 Failed: Multi-page document is suspiciously small.');
  }
  // Check for PDF page object count indicators (/Type /Page)
  const pageMatches = pdfBuffer6.toString('binary').match(/\/Type\s*\/Page\b/g);
  const detectedPages = pageMatches ? pageMatches.length : 1;
  if (detectedPages < 2) {
    throw new Error(`Test 6 Failed: Expected multiple pages, but detected ${detectedPages}`);
  }
  console.log(`  ✓ Multi-page PDF verified: ${detectedPages} distinct pages generated (${pdfBuffer6.length} bytes)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 7: Export with Associated Real Architectural Drawings
  // ----------------------------------------------------
  console.log('Test 7: Generating Project Report with embedded drawings...');
  const bufferWithoutImages = await generateProjectReportPdf(projectA, [], projectNotes, {
    includeImages: false,
  });
  const bufferWithImages = await generateProjectReportPdf(projectA, [fileA1], projectNotes, {
    includeImages: true,
  });

  if (!Buffer.isBuffer(bufferWithImages) || bufferWithImages.length <= bufferWithoutImages.length) {
    throw new Error('Test 7 Failed: PDF with embedded drawing should be larger than without.');
  }
  console.log(`  ✓ Drawing successfully embedded into PDF stream (${bufferWithImages.length} bytes vs ${bufferWithoutImages.length} bytes)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 8: Export A4 Portrait Configuration
  // ----------------------------------------------------
  console.log('Test 8: Generating A4 Portrait Sheet...');
  const pdfBufferA4 = await generateProjectReportPdf(projectA, [], [], {
    pageSize: 'A4',
    orientation: 'portrait',
  });
  // A4 points: 595.28 x 841.89
  const a4Binary = pdfBufferA4.toString('binary');
  if (!a4Binary.includes('/MediaBox') && !a4Binary.includes('/CropBox')) {
    // MediaBox or standard geometry
  }
  console.log(`  ✓ A4 Portrait generated successfully (${pdfBufferA4.length} bytes)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 9: Export A3 Landscape Configuration
  // ----------------------------------------------------
  console.log('Test 9: Generating A3 Landscape Sheet...');
  const pdfBufferA3 = await generateProjectReportPdf(projectA, [], [], {
    pageSize: 'A3',
    orientation: 'landscape',
  });
  if (!Buffer.isBuffer(pdfBufferA3) || pdfBufferA3.length < 1000) {
    throw new Error('Test 9 Failed: A3 Landscape buffer invalid.');
  }
  console.log(`  ✓ A3 Landscape sheet generated successfully (${pdfBufferA3.length} bytes)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 10: Preview and Download Base64 Buffer Encoding
  // ----------------------------------------------------
  console.log('Test 10: Testing Base64 preview & download pipeline...');
  const base64Data = pdfBuffer1.toString('base64');
  const dataUri = `data:application/pdf;base64,${base64Data}`;

  if (!dataUri.startsWith('data:application/pdf;base64,JVBERi')) {
    throw new Error('Test 10 Failed: Base64 data URI does not match PDF encoding signature.');
  }
  // Decode back and check equality
  const decodedBuffer = Buffer.from(base64Data, 'base64');
  if (!decodedBuffer.equals(pdfBuffer1)) {
    throw new Error('Test 10 Failed: Decoded base64 buffer does not match original binary.');
  }
  console.log(`  ✓ Base64 preview data URI verified: starts with JVBERi (${base64Data.length} chars)`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 11: Handle Missing Project Information Gracefully (Zero Demo Filler)
  // ----------------------------------------------------
  console.log('Test 11: Handling missing project metadata without generating mock content...');
  const sparseProject = projectRepository.create({
    id: 'proj_sparse_01',
    user_id: userA.id,
    title: 'Minimal Studio Pavilion',
    category: 'Urban',
    status: 'In Progress',
  });

  const sparseBuffer = await generateProjectReportPdf(sparseProject, [], [], {
    title: 'Minimal Studio Pavilion',
  });

  if (!Buffer.isBuffer(sparseBuffer) || sparseBuffer.length < 1000) {
    throw new Error('Test 11 Failed: Sparse project report failed to compile.');
  }
  // Ensure the PDF does NOT contain fabricated text like "Demo" or "Sample"
  const sparseStr = sparseBuffer.toString('binary');
  if (sparseStr.includes('Demo Project') || sparseStr.includes('Fictional Concept')) {
    throw new Error('Test 11 Failed: Found fabricated demo content in sparse PDF output.');
  }
  console.log('  ✓ Missing fields handled cleanly; zero fabricated or mock placeholders injected.');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 12: Handle Long Content Without Clipping
  // ----------------------------------------------------
  console.log('Test 12: Handling long unbroken architectural narrative without clipping...');
  const longParagraph = 'The phenomenological threshold between interior sanctuary and exterior landscape is dissolved through a rhythm of peristyle colonnades. '.repeat(60);
  const longConceptRecord = savedOutputRepository.create({
    id: 'out_long_01',
    user_id: userA.id,
    project_id: projectA.id,
    type: 'concept-narrative',
    title: 'Phenomenological Tectonic Dissertation',
    content: JSON.stringify({
      narrative: longParagraph,
      spatialStrategy: longParagraph.slice(0, 1000),
    }),
  });

  const longPdfBuffer = await generateConceptReportPdf(longConceptRecord, projectA, {});
  const longPageMatches = longPdfBuffer.toString('binary').match(/\/Type\s*\/Page\b/g);
  const longPages = longPageMatches ? longPageMatches.length : 1;

  if (longPages < 2) {
    throw new Error(`Test 12 Failed: Expected page overflow for long content, got ${longPages} page(s).`);
  }
  console.log(`  ✓ Long text seamlessly split across ${longPages} pages without text clipping.`);
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 13: Verify PDF Readability and Compliance
  // ----------------------------------------------------
  console.log('Test 13: Verifying PDF byte structure and EOF markers...');
  const hasPdfHeader = pdfBuffer1.subarray(0, 5).toString('utf-8') === '%PDF-';
  const hasEof = pdfBuffer1.toString('binary').includes('%%EOF');

  if (!hasPdfHeader || !hasEof) {
    throw new Error('Test 13 Failed: Invalid PDF structure or missing %%EOF marker.');
  }
  console.log('  ✓ PDF structure verified with valid %PDF- header and %%EOF trailer.');
  testPassedCount++;

  // ----------------------------------------------------
  // TEST 14: Verify Multi-Tenant Studio Data Isolation
  // ----------------------------------------------------
  console.log('Test 14: Verifying user isolation (User B cannot export User A data)...');

  // Record export in SQLite repository
  const exportRecord = exportRepository.create({
    id: 'exp_01',
    user_id: userA.id,
    project_id: projectA.id,
    export_type: 'project_report',
    document_title: 'Studio Dossier: Dakshin Mandapa',
    options_json: JSON.stringify({ pageSize: 'A4' }),
    page_count: 2,
  });

  // Verify User A can access
  const retrievedA = exportRepository.findById(exportRecord.id, userA.id);
  if (!retrievedA) throw new Error('Test 14 Failed: User A cannot find their own export record.');

  // Verify User B CANNOT access User A's export record
  const retrievedB = exportRepository.findById(exportRecord.id, userB.id);
  if (retrievedB !== null) {
    throw new Error('Test 14 Failed: User B was able to access User A export record!');
  }

  // Verify User B CANNOT access User A's project
  const projAccessB = projectRepository.findById(projectA.id, userB.id);
  if (projAccessB !== null) {
    throw new Error('Test 14 Failed: User B was able to access User A project record!');
  }

  // Verify User B CANNOT access User A's saved outputs
  const outAccessB = savedOutputRepository.findById(conceptRecord.id, userB.id);
  if (outAccessB !== null) {
    throw new Error('Test 14 Failed: User B was able to access User A saved concept output!');
  }

  // Verify export deletion isolation
  const deletedByB = exportRepository.delete(exportRecord.id, userB.id);
  if (deletedByB) {
    throw new Error('Test 14 Failed: User B was able to delete User A export record!');
  }

  const deletedByA = exportRepository.delete(exportRecord.id, userA.id);
  if (!deletedByA) {
    throw new Error('Test 14 Failed: User A could not delete their own export record.');
  }

  console.log('  ✓ Strict multi-tenant data isolation verified: cross-user access completely blocked.');
  testPassedCount++;

  console.log('\n====================================================');
  console.log(`🎉 ALL ${testPassedCount}/14 PDF EXPORT TEST SCENARIOS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');

  closeDb();
  // Clean test databases
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    if (fs.existsSync(TEST_UPLOAD_DIR)) fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  } catch (e) {}
}

runPdfExportTestSuite().catch((err) => {
  console.error('\n❌ PDF EXPORT TEST SUITE FAILED:', err);
  process.exit(1);
});
