import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { ProjectRecord, SavedOutputRecord, ConversationRecord, MessageRecord, ProjectFileRecord, ExportCustomOptions } from '../types/db';

export interface ReportContext {
  authorName?: string;
  institutionName?: string;
  date?: string;
  subtitle?: string;
  title?: string;
  pageSize?: 'A4' | 'A3';
  orientation?: 'portrait' | 'landscape';
  sections?: { [key: string]: boolean };
  includeImages?: boolean;
}

// Architectural Palette for PDF Rendering
const PALETTE = {
  espresso: '#482A18',
  darkInk: '#241A14',
  mutedInk: '#5E4E42',
  faintInk: '#857467',
  border: '#C9B49A',
  creamLight: '#FAF4EA',
  parchment: '#F3E5CF',
  calloutBg: '#F8EFE2',
  calloutBorder: '#DEC9B0',
};

/**
 * Builds base PDF document with standard architectural geometry and margins.
 */
function createBaseDocument(options: ExportCustomOptions = {}): PDFKit.PDFDocument {
  const size = options.pageSize === 'A3' ? 'A3' : 'A4';
  const layout = options.orientation === 'landscape' ? 'landscape' : 'portrait';

  return new PDFDocument({
    size,
    layout,
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50,
    },
    bufferPages: true,
    autoFirstPage: true,
  });
}

/**
 * Applies professional architectural headers and footers to all pages.
 */
function applyHeaderAndFooter(doc: PDFKit.PDFDocument, documentTypeLabel: string, docTitle: string) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = range.start; i < range.start + totalPages; i++) {
    doc.switchToPage(i);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // Header (on pages after Page 1)
    if (i > range.start) {
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(PALETTE.espresso)
        .text('ARCHORA ARCHITECTURE STUDIO', margin, 28, { continued: true })
        .font('Helvetica')
        .fillColor(PALETTE.faintInk)
        .text(`  •  ${documentTypeLabel.toUpperCase()}  •  ${docTitle.slice(0, 45)}`);

      doc
        .strokeColor(PALETTE.border)
        .lineWidth(0.5)
        .moveTo(margin, 40)
        .lineTo(margin + contentWidth, 40)
        .stroke();
    }

    // Footer (on all pages)
    doc
      .strokeColor(PALETTE.border)
      .lineWidth(0.5)
      .moveTo(margin, pageHeight - 38)
      .lineTo(margin + contentWidth, pageHeight - 38)
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(PALETTE.faintInk)
      .text('Confidential Studio Document • Built with Archora AI Workspace', margin, pageHeight - 28, {
        width: contentWidth * 0.7,
        align: 'left',
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PALETTE.espresso)
      .text(`Page ${i - range.start + 1} of ${totalPages}`, margin + contentWidth * 0.7, pageHeight - 28, {
        width: contentWidth * 0.3,
        align: 'right',
      });
  }
}

/**
 * Draws standard editorial title block.
 */
function drawTitleBlock(
  doc: PDFKit.PDFDocument,
  kicker: string,
  title: string,
  subtitle?: string,
  metadata?: { label: string; value: string }[]
) {
  const margin = 50;
  const contentWidth = doc.page.width - margin * 2;

  // Kicker Pill
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(PALETTE.espresso)
    .text(kicker.toUpperCase(), { characterSpacing: 1.2 });

  doc.moveDown(0.4);

  // Main Document Title
  doc
    .font('Times-Bold')
    .fontSize(22)
    .fillColor(PALETTE.darkInk)
    .text(title, { width: contentWidth, lineGap: 2 });

  // Optional Subtitle
  if (subtitle && subtitle.trim()) {
    doc.moveDown(0.3);
    doc
      .font('Times-Italic')
      .fontSize(12)
      .fillColor(PALETTE.mutedInk)
      .text(subtitle.trim(), { width: contentWidth });
  }

  // Metadata Grid
  if (metadata && metadata.length > 0) {
    doc.moveDown(0.8);
    const startY = doc.y;
    const colWidth = contentWidth / Math.min(metadata.length, 4);

    metadata.forEach((item, idx) => {
      const colX = margin + (idx % 4) * colWidth;
      const rowY = startY + Math.floor(idx / 4) * 26;

      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(PALETTE.faintInk)
        .text(item.label.toUpperCase(), colX, rowY, { characterSpacing: 0.8 });

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(PALETTE.darkInk)
        .text(item.value || '—', colX, rowY + 10, { width: colWidth - 8, lineBreak: false });
    });

    const rowsCount = Math.ceil(metadata.length / 4);
    doc.y = startY + rowsCount * 26 + 10;
  }

  doc.moveDown(0.6);
  doc
    .strokeColor(PALETTE.border)
    .lineWidth(1)
    .moveTo(margin, doc.y)
    .lineTo(margin + contentWidth, doc.y)
    .stroke();

  doc.moveDown(1);
}

/**
 * Draws a section header with horizontal rule.
 */
function drawSectionHeading(doc: PDFKit.PDFDocument, heading: string) {
  checkPageOverflow(doc, 60);

  const margin = 50;
  const contentWidth = doc.page.width - margin * 2;

  doc.moveDown(0.6);
  doc
    .font('Times-Bold')
    .fontSize(13)
    .fillColor(PALETTE.espresso)
    .text(heading, { lineGap: 1 });

  doc
    .strokeColor(PALETTE.border)
    .lineWidth(0.5)
    .moveTo(margin, doc.y + 3)
    .lineTo(margin + contentWidth, doc.y + 3)
    .stroke();

  doc.moveDown(0.8);
}

/**
 * Ensures sufficient vertical space before rendering blocks, adding page when needed.
 */
function checkPageOverflow(doc: PDFKit.PDFDocument, neededHeight: number) {
  const bottomThreshold = doc.page.height - doc.page.margins.bottom - 40;
  if (doc.y + neededHeight > bottomThreshold) {
    doc.addPage();
  }
}

/**
 * Draws a callout card (e.g. for student notes or examiner intent).
 */
function drawCalloutBox(doc: PDFKit.PDFDocument, title: string, content: string) {
  checkPageOverflow(doc, 80);

  const margin = 50;
  const contentWidth = doc.page.width - margin * 2;
  const startY = doc.y;

  doc.font('Helvetica').fontSize(9);
  const textHeight = doc.heightOfString(content, { width: contentWidth - 24, lineGap: 2 });
  const boxHeight = Math.max(textHeight + 32, 50);

  // Background rect
  doc
    .rect(margin, startY, contentWidth, boxHeight)
    .fillAndStroke(PALETTE.calloutBg, PALETTE.calloutBorder);

  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(PALETTE.espresso)
    .text(title.toUpperCase(), margin + 12, startY + 10, { characterSpacing: 0.8 });

  // Body Content
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(PALETTE.darkInk)
    .text(content, margin + 12, startY + 22, {
      width: contentWidth - 24,
      lineGap: 2,
    });

  doc.y = startY + boxHeight + 12;
}

/**
 * Converts a PDFKit stream to a Promise<Buffer>.
 */
function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
    doc.end();
  });
}

// ==============================================================
// 1. PROJECT REPORT PDF GENERATOR
// ==============================================================
export async function generateProjectReportPdf(
  project: ProjectRecord,
  files: ProjectFileRecord[] = [],
  notes: { content: string; author: string; created_at: string }[] = [],
  options: ExportCustomOptions = {}
): Promise<Buffer> {
  const doc = createBaseDocument(options);
  const title = options.title || project.title || 'Studio Project Report';
  const subtitle = options.subtitle || project.description;

  const metadata = [
    { label: 'Architect / Student', value: options.authorName || 'Studio Architect' },
    { label: 'Institution', value: options.institutionName || 'Faculty of Architecture' },
    { label: 'Semester & Year', value: `${project.semester || 'Studio'} (${project.year || 2026})` },
    { label: 'Date', value: options.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
    { label: 'Typology', value: project.typology || project.category },
    { label: 'Site Location', value: project.site_location || 'Not Specified' },
    { label: 'Site Dimensions / Area', value: `${project.site_area || '—'} ${project.site_location ? `(${project.site_location})` : ''}` },
    { label: 'Style / Tectonics', value: project.architectural_style || 'Contemporary Vernacular' },
  ];

  drawTitleBlock(doc, 'Studio Project Dossier', title, subtitle, metadata);

  // Section 1: Project Description & Scope
  if (options.sections?.description !== false && project.description) {
    drawSectionHeading(doc, '1. Project Description & Academic Brief');
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(PALETTE.darkInk)
      .text(project.description, { lineGap: 3, align: 'justify' });
    doc.moveDown(0.8);
  }

  // Section 2: Site Analysis & Context
  if (options.sections?.site !== false && (project.site_location || project.site_area)) {
    drawSectionHeading(doc, '2. Site Dimensions & Environmental Context');
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(PALETTE.darkInk)
      .text(
        `The project is sited at ${project.site_location || 'the specified location'}, spanning a site area of ${project.site_area || 'the designated studio parcel'}. Design investigations respect solar path geometry, seasonal prevailing breezes, and local urban zoning regulations.`,
        { lineGap: 3 }
      );
    doc.moveDown(0.8);
  }

  // Section 3: Architectural Style & Tectonic Logic
  if (options.sections?.style !== false && project.architectural_style) {
    drawSectionHeading(doc, '3. Architectural Style & Material Tectonics');
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(PALETTE.darkInk)
      .text(
        `Framed within the discipline of ${project.architectural_style}, structural systems prioritize tectonic clarity, material longevity, and contextual responsiveness.`,
        { lineGap: 3 }
      );
    doc.moveDown(0.8);
  }

  // Section 4: Studio Critique Notes
  if (options.sections?.notes !== false && notes.length > 0) {
    drawSectionHeading(doc, '4. Studio Critique Notes & Revisions');
    notes.forEach((note, idx) => {
      drawCalloutBox(
        doc,
        `Critique Entry ${idx + 1} • ${note.author} (${new Date(note.created_at).toLocaleDateString()})`,
        note.content
      );
    });
  }

  // Section 5: Associated Reference Drawings / Images
  if (options.includeImages !== false && files.length > 0) {
    const imageFiles = files.filter((f) =>
      ['.jpg', '.jpeg', '.png', '.webp'].includes(f.file_extension.toLowerCase())
    );

    if (imageFiles.length > 0) {
      drawSectionHeading(doc, '5. Drawing Sheets & Reference Etchings');
      for (const imgFile of imageFiles.slice(0, 3)) {
        if (fs.existsSync(imgFile.storage_path)) {
          checkPageOverflow(doc, 220);
          try {
            const startY = doc.y;
            const contentWidth = doc.page.width - 100;
            doc.image(imgFile.storage_path, 50, startY, {
              fit: [contentWidth, 180],
              align: 'center',
            });
            doc.y = startY + 185;
            doc
              .font('Helvetica-Oblique')
              .fontSize(8)
              .fillColor(PALETTE.faintInk)
              .text(`${imgFile.original_filename} (${imgFile.category})`, 50, doc.y, {
                width: contentWidth,
                align: 'center',
              });
            doc.moveDown(0.8);
          } catch (e) {
            console.warn('[PDFGenerator] Could not embed image:', imgFile.storage_path);
          }
        }
      }
    }
  }

  applyHeaderAndFooter(doc, 'Project Dossier', title);
  return streamToBuffer(doc);
}

// ==============================================================
// 2. DESIGN CONCEPT REPORT PDF GENERATOR
// ==============================================================
export async function generateConceptReportPdf(
  conceptOutput: SavedOutputRecord,
  project?: ProjectRecord | null,
  options: ExportCustomOptions = {}
): Promise<Buffer> {
  const doc = createBaseDocument(options);
  const title = options.title || conceptOutput.title || 'Architectural Design Concept';
  const subtitle = options.subtitle || (project ? `Studio Scheme for ${project.title}` : 'Generative Architectural Synthesis');

  const metadata = [
    { label: 'Architect / Student', value: options.authorName || 'Studio Architect' },
    { label: 'Institution', value: options.institutionName || 'Faculty of Architecture' },
    { label: 'Project Context', value: project?.title || 'Independent Studio Ideation' },
    { label: 'Date', value: options.date || new Date(conceptOutput.created_at).toLocaleDateString() },
  ];

  drawTitleBlock(doc, 'Architectural Concept Synthesis', title, subtitle, metadata);

  // Parse structured concept content
  const rawText = conceptOutput.content || '';
  const sections = rawText.split(/\n(?=###?\s+|[A-Z][A-Za-z &]{3,30}:)/);

  if (sections.length > 0 && sections[0].trim()) {
    sections.forEach((sec, idx) => {
      const trimmed = sec.trim();
      if (!trimmed) return;

      const lines = trimmed.split('\n');
      const firstLine = lines[0].replace(/^#+\s*/, '').replace(/:$/, '').trim();
      const bodyLines = lines.slice(1).join('\n').trim();

      if (firstLine && bodyLines) {
        drawSectionHeading(doc, `${idx + 1}. ${firstLine}`);
        doc
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor(PALETTE.darkInk)
          .text(bodyLines, { lineGap: 3, align: 'justify' });
        doc.moveDown(0.8);
      } else {
        // Unstructured paragraph
        checkPageOverflow(doc, 40);
        doc
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor(PALETTE.darkInk)
          .text(trimmed, { lineGap: 3 });
        doc.moveDown(0.8);
      }
    });
  } else {
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(PALETTE.darkInk)
      .text(rawText, { lineGap: 3 });
  }

  applyHeaderAndFooter(doc, 'Design Concept', title);
  return streamToBuffer(doc);
}

// ==============================================================
// 3. ARCHITECTURE TUTOR NOTES PDF GENERATOR
// ==============================================================
export async function generateTutorNotesPdf(
  conversation: ConversationRecord,
  messages: MessageRecord[],
  options: ExportCustomOptions = {}
): Promise<Buffer> {
  const doc = createBaseDocument(options);
  const title = options.title || conversation.title || 'Architecture Tutor Notes';
  const subtitle = options.subtitle || (conversation.topic ? `Topic Focus: ${conversation.topic}` : 'Studio Dialog & Historical Precedents');

  const metadata = [
    { label: 'Student / Scholar', value: options.authorName || 'Studio Architect' },
    { label: 'Institution', value: options.institutionName || 'Faculty of Architecture' },
    { label: 'Module', value: 'Architecture Tutor (Gemini Studio)' },
    { label: 'Date', value: options.date || new Date(conversation.created_at).toLocaleDateString() },
  ];

  drawTitleBlock(doc, 'Studio Tutorial Transcript', title, subtitle, metadata);

  // Render dialogue exchange
  let inquiryIndex = 1;
  for (const msg of messages) {
    if (msg.role === 'user') {
      checkPageOverflow(doc, 60);
      drawCalloutBox(doc, `Studio Inquiry ${inquiryIndex}`, msg.content);
      inquiryIndex++;
    } else if (msg.role === 'assistant') {
      checkPageOverflow(doc, 70);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(PALETTE.espresso)
        .text('TUTOR ANALYSIS & TECTONIC GUIDANCE:');
      doc.moveDown(0.3);

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(PALETTE.darkInk)
        .text(msg.content, { lineGap: 2.5, align: 'justify' });
      doc.moveDown(1);
    }
  }

  applyHeaderAndFooter(doc, 'Tutor Notes', title);
  return streamToBuffer(doc);
}

// ==============================================================
// 4. JURY PREPARATION REPORT PDF GENERATOR
// ==============================================================
export async function generateJuryPrepPdf(
  juryOutput: SavedOutputRecord,
  project?: ProjectRecord | null,
  options: ExportCustomOptions = {}
): Promise<Buffer> {
  const doc = createBaseDocument(options);
  const title = options.title || juryOutput.title || 'Jury Defense & Viva Critique Dossier';
  const subtitle = options.subtitle || (project ? `Defense Preparation for ${project.title}` : 'Studio Examination Strategy');

  const metadata = [
    { label: 'Candidate', value: options.authorName || 'Studio Architect' },
    { label: 'Institution', value: options.institutionName || 'Faculty of Architecture' },
    { label: 'Project Context', value: project?.title || 'Studio Defense' },
    { label: 'Date', value: options.date || new Date(juryOutput.created_at).toLocaleDateString() },
  ];

  drawTitleBlock(doc, 'Jury Defense Dossier', title, subtitle, metadata);

  // Check if content has structured JSON questions
  let parsedMeta: any = {};
  try {
    parsedMeta = JSON.parse(juryOutput.metadata_json || '{}');
  } catch (e) {}

  const vivaList = parsedMeta.vivaQuestions || [];

  if (Array.isArray(vivaList) && vivaList.length > 0) {
    drawSectionHeading(doc, 'Anticipated Jury Critique Questions & Defense Strategies');
    vivaList.forEach((item: any, idx: number) => {
      checkPageOverflow(doc, 110);

      // Question
      doc
        .font('Times-Bold')
        .fontSize(11)
        .fillColor(PALETTE.darkInk)
        .text(`Q${idx + 1}: ${item.question}`);
      doc.moveDown(0.3);

      // Examiner Intent
      if (item.intent) {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(PALETTE.espresso)
          .text('EXAMINER INTENT: ', { continued: true })
          .font('Helvetica')
          .fillColor(PALETTE.mutedInk)
          .text(item.intent);
        doc.moveDown(0.2);
      }

      // Suggested Defense
      if (item.suggestedAnswer) {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(PALETTE.espresso)
          .text('SUGGESTED DEFENSE: ', { continued: true })
          .font('Helvetica')
          .fillColor(PALETTE.darkInk)
          .text(item.suggestedAnswer, { lineGap: 2 });
      }

      doc.moveDown(0.8);
    });
  } else {
    // Plain text content
    drawSectionHeading(doc, '1. Viva Defense Analysis & Presentation Points');
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(PALETTE.darkInk)
      .text(juryOutput.content, { lineGap: 3, align: 'justify' });
  }

  applyHeaderAndFooter(doc, 'Jury Dossier', title);
  return streamToBuffer(doc);
}

// ==============================================================
// 5. PORTFOLIO CONTENT PDF GENERATOR
// ==============================================================
export async function generatePortfolioPdf(
  portfolioOutput: SavedOutputRecord,
  project?: ProjectRecord | null,
  options: ExportCustomOptions = {}
): Promise<Buffer> {
  const doc = createBaseDocument(options);
  const title = options.title || portfolioOutput.title || 'Studio Portfolio Presentation';
  const subtitle = options.subtitle || (project ? `Project Statement for ${project.title}` : 'Architectural Narrative');

  const metadata = [
    { label: 'Author / Architect', value: options.authorName || 'Studio Architect' },
    { label: 'Institution', value: options.institutionName || 'Faculty of Architecture' },
    { label: 'Project Context', value: project?.title || 'Academic Studio' },
    { label: 'Date', value: options.date || new Date().toLocaleDateString() },
  ];

  drawTitleBlock(doc, 'Portfolio Editorial Sheet', title, subtitle, metadata);

  drawSectionHeading(doc, 'Architectural Statement & Project Narrative');
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(PALETTE.darkInk)
    .text(portfolioOutput.content, { lineGap: 3.5, align: 'justify' });

  applyHeaderAndFooter(doc, 'Portfolio Sheet', title);
  return streamToBuffer(doc);
}

// ==============================================================
// 6. VASTUVISION ANALYSIS REPORT PDF GENERATOR
// ==============================================================
export async function generateVastuReportPdf(
  analysis: any,
  project?: ProjectRecord | null,
  options: ExportCustomOptions = {}
): Promise<Buffer> {
  const doc = createBaseDocument(options);
  const title = options.title || analysis.title || 'VastuVision Architectural Assessment';
  const subtitle = options.subtitle || (project ? `Project: ${project.title}` : `Typology: ${analysis.building_type || 'Residential'}`);
  const margin = 50;
  const contentWidth = doc.page.width - margin * 2;

  const results = typeof analysis.results_json === 'string' ? JSON.parse(analysis.results_json || '{}') : (analysis.results || {});
  const rooms = typeof analysis.rooms_json === 'string' ? JSON.parse(analysis.rooms_json || '[]') : (analysis.rooms || []);
  const roomEvaluations = results.roomEvaluations || [];

  const metadata = [
    { label: 'Building Type', value: analysis.building_type || 'Residential' },
    { label: 'Tradition Canon', value: analysis.tradition || 'Manasara' },
    { label: 'Geographic North', value: `${analysis.geographic_north_degrees ?? 0}° off vertical` },
    { label: 'Alignment Index', value: `${results.alignmentScore ?? 85}% Concordance` },
  ];

  drawTitleBlock(doc, 'VastuVision Architectural Assessment', title, subtitle, metadata);

  // 1. Executive Summary & Concordance Metrics
  drawSectionHeading(doc, '1. Executive Evaluation & Directional Orientation');
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(PALETTE.espresso)
    .text(`Overall Assessment: ${results.overallAssessment || 'Balanced spatial orientation.'}`);
  
  doc.moveDown(0.4);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(PALETTE.darkInk)
    .text(results.environmentalSummary || `Geographic orientation is calibrated with North at ${analysis.geographic_north_degrees ?? 0} degrees. Spaces are configured against canonical cardinal axes.`, { lineGap: 2.5 });

  doc.moveDown(0.8);

  // Metric Callouts
  const metricBoxWidth = (contentWidth - 30) / 4;
  const metricY = doc.y;
  const metrics = [
    { label: 'Total Rooms', value: `${rooms.length || roomEvaluations.length}`, color: PALETTE.espresso },
    { label: 'Matches Guidance', value: `${results.matchesCount ?? 0}`, color: '#047857' },
    { label: 'Acceptable Alt.', value: `${results.acceptableCount ?? 0}`, color: '#0284c7' },
    { label: 'Deviations', value: `${results.deviationsCount ?? 0}`, color: '#b45309' },
  ];

  metrics.forEach((m, idx) => {
    const boxX = margin + idx * (metricBoxWidth + 10);
    doc
      .rect(boxX, metricY, metricBoxWidth, 42)
      .fillAndStroke(PALETTE.calloutBg, PALETTE.calloutBorder);

    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(PALETTE.faintInk)
      .text(m.label.toUpperCase(), boxX + 6, metricY + 8, { width: metricBoxWidth - 12 });

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(m.color)
      .text(m.value, boxX + 6, metricY + 20, { width: metricBoxWidth - 12 });
  });

  doc.y = metricY + 54;

  // 2. Room-by-Room Directional Assessment
  drawSectionHeading(doc, '2. Room-by-Room Canonical Spatial Analysis');

  if (roomEvaluations.length === 0) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(PALETTE.mutedInk)
      .text('No individual rooms placed or evaluated in this assessment.');
  } else {
    roomEvaluations.forEach((evalItem: any, idx: number) => {
      checkPageOverflow(doc, 75);
      const startBoxY = doc.y;

      // Status indicator color
      const isMatch = evalItem.status === 'Matches selected Vastu guidance';
      const isAcceptable = evalItem.status === 'Acceptable traditional alternative';
      const isDeviation = evalItem.status === 'Potential deviation';
      const statusColor = isMatch ? '#047857' : isAcceptable ? '#0284c7' : isDeviation ? '#b45309' : '#4b5563';

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(PALETTE.darkInk)
        .text(`${idx + 1}. ${evalItem.roomName || evalItem.spaceType} — ${evalItem.detectedDirection} (${evalItem.directionDegrees ?? 0}°)`, margin, doc.y);

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(statusColor)
        .text(`[${evalItem.status}]`, margin + contentWidth - 160, startBoxY, { width: 160, align: 'right' });

      doc.moveDown(0.3);
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(PALETTE.darkInk)
        .text(`Recommendation: ${evalItem.traditionalRecommendation}`, { lineGap: 2 });

      doc.moveDown(0.2);
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(PALETTE.mutedInk)
        .text(`Architectural Rationale: ${evalItem.architecturalRationale}`, { lineGap: 2 });

      if (evalItem.sourceReference) {
        doc.moveDown(0.2);
        doc
          .font('Times-Italic')
          .fontSize(7.5)
          .fillColor(PALETTE.faintInk)
          .text(`Canonical Source: ${evalItem.sourceReference}`);
      }

      doc.moveDown(0.6);
      doc
        .strokeColor(PALETTE.border)
        .lineWidth(0.3)
        .moveTo(margin, doc.y)
        .lineTo(margin + contentWidth, doc.y)
        .stroke();
      doc.moveDown(0.6);
    });
  }

  // 3. AI Commentary & Synthesis (if present)
  if (analysis.summary || results.commentary) {
    checkPageOverflow(doc, 90);
    drawSectionHeading(doc, '3. Architectural Synthesis & Recommendations');
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PALETTE.darkInk)
      .text(analysis.summary || results.commentary, { lineGap: 3, align: 'justify' });
  }

  // 4. Classical Sources Reference
  checkPageOverflow(doc, 70);
  drawSectionHeading(doc, '4. Classical Treatise References');
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(PALETTE.mutedInk)
    .text(
      '• Manasara (Chapters 7-15: Dvara-Lakshana, Dik-Pariccheda & Griha-Vinyasa)\n' +
      '• Mayamata (Chapters 10-14: Vastuniryana, Dwelling Orientation & Directional Divisions)\n' +
      '• Brihat Samhita (Varahamihira, Chapter 53: Vastu-Vidya & Chapter 54: Dakargala)\n' +
      '• Vishvakarma Prakash (Traditional Craft Treatise on Domestic Spatial Harmony)',
      { lineGap: 3 }
    );

  // 5. Professional Responsibility Notice
  checkPageOverflow(doc, 60);
  doc.moveDown(1);
  doc
    .rect(margin, doc.y, contentWidth, 48)
    .fillAndStroke(PALETTE.calloutBg, PALETTE.calloutBorder);

  const noticeY = doc.y + 6;
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(PALETTE.espresso)
    .text('ARCHITECTURAL & REGULATORY DISCLAIMER', margin + 8, noticeY);

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(PALETTE.darkInk)
    .text(
      results.disclaimer ||
      'Vastu Shastra recommendations are educational vernacular traditions and design reflections. Modern building codes, fire and life safety, structural engineering, accessibility, and environmental standards always supersede traditional guidelines.',
      margin + 8,
      noticeY + 12,
      { width: contentWidth - 16, lineGap: 1.5 }
    );

  applyHeaderAndFooter(doc, 'VastuVision Report', title);
  return streamToBuffer(doc);
}

