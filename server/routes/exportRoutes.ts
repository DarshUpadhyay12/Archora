import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { projectRepository } from '../repositories/projectRepository';
import { savedOutputRepository } from '../repositories/savedOutputRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { fileRepository } from '../repositories/fileRepository';
import { exportRepository } from '../repositories/exportRepository';
import { vastuRepository } from '../repositories/vastuRepository';
import { sanitizeFilename } from '../services/fileStorageService';
import {
  generateProjectReportPdf,
  generateConceptReportPdf,
  generateTutorNotesPdf,
  generateJuryPrepPdf,
  generatePortfolioPdf,
  generateVastuReportPdf,
} from '../services/pdfGeneratorService';
import { ExportDocumentType, ExportCustomOptions } from '../types/db';

export const exportRouter = Router();

// Protect all export endpoints with studio authentication
exportRouter.use(requireAuth);

/**
 * Generates the PDF buffer based on export type, target ID, and options.
 */
async function generateDocumentBuffer(
  userId: string,
  exportType: ExportDocumentType,
  targetId: string,
  options: ExportCustomOptions = {}
): Promise<{ buffer: Buffer; documentTitle: string; projectId: string | null }> {
  switch (exportType) {
    case 'project_report': {
      const project = projectRepository.findById(targetId, userId);
      if (!project) throw new Error('Project not found or access denied.');

      const files = fileRepository.findByUser(userId, { projectId: targetId });
      const notes = projectRepository.listNotes(targetId, userId);
      const title = options.title || project.title || 'Studio Project Report';

      const buffer = await generateProjectReportPdf(project, files, notes, options);
      return { buffer, documentTitle: title, projectId: project.id };
    }

    case 'concept_report': {
      const savedOutput = savedOutputRepository.findById(targetId, userId);
      if (!savedOutput) throw new Error('Saved concept output not found or access denied.');

      const project = savedOutput.project_id
        ? projectRepository.findById(savedOutput.project_id, userId)
        : null;
      const title = options.title || savedOutput.title || 'Design Concept Synthesis';

      const buffer = await generateConceptReportPdf(savedOutput, project, options);
      return { buffer, documentTitle: title, projectId: savedOutput.project_id || null };
    }

    case 'tutor_notes': {
      const conversation = conversationRepository.findById(targetId, userId);
      if (!conversation) throw new Error('Conversation not found or access denied.');

      const messages = conversationRepository.getMessagesByConversationId(targetId, userId);
      const title = options.title || conversation.title || 'Architecture Tutor Notes';

      const buffer = await generateTutorNotesPdf(conversation, messages, options);
      return { buffer, documentTitle: title, projectId: conversation.project_id || null };
    }

    case 'jury_prep': {
      const savedOutput = savedOutputRepository.findById(targetId, userId);
      if (!savedOutput) throw new Error('Jury preparation output not found or access denied.');

      const project = savedOutput.project_id
        ? projectRepository.findById(savedOutput.project_id, userId)
        : null;
      const title = options.title || savedOutput.title || 'Jury Defense Dossier';

      const buffer = await generateJuryPrepPdf(savedOutput, project, options);
      return { buffer, documentTitle: title, projectId: savedOutput.project_id || null };
    }

    case 'portfolio': {
      const savedOutput = savedOutputRepository.findById(targetId, userId);
      if (!savedOutput) throw new Error('Portfolio output not found or access denied.');

      const project = savedOutput.project_id
        ? projectRepository.findById(savedOutput.project_id, userId)
        : null;
      const title = options.title || savedOutput.title || 'Studio Portfolio Presentation';

      const buffer = await generatePortfolioPdf(savedOutput, project, options);
      return { buffer, documentTitle: title, projectId: savedOutput.project_id || null };
    }

    case 'vastu_report': {
      const analysis = vastuRepository.findById(targetId, userId);
      if (!analysis) throw new Error('Vastu analysis not found or access denied.');

      const project = analysis.project_id
        ? projectRepository.findById(analysis.project_id, userId)
        : null;
      const title = options.title || analysis.title || 'VastuVision Architectural Assessment';

      const buffer = await generateVastuReportPdf(analysis, project, options);
      return { buffer, documentTitle: title, projectId: analysis.project_id || null };
    }

    default:
      throw new Error(`Unsupported export type: ${exportType}`);
  }
}

/**
 * POST /api/export/pdf
 * Generates an architectural PDF and returns base64 for instant preview or direct download.
 */
exportRouter.post('/pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { exportType, targetId, options } = req.body;

    if (!exportType || !targetId) {
      return res.status(400).json({ error: 'exportType and targetId are required parameters.' });
    }

    const { buffer, documentTitle, projectId } = await generateDocumentBuffer(
      userId,
      exportType,
      targetId,
      options || {}
    );

    const safeFilename = `${sanitizeFilename(documentTitle).replace(/\s+/g, '_')}.pdf`;
    const exportId = `exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Record export in SQLite audit log
    exportRepository.create({
      id: exportId,
      user_id: userId,
      project_id: projectId,
      export_type: exportType,
      document_title: documentTitle,
      options: options || {},
      file_path: null,
      page_count: 1,
    });

    return res.json({
      success: true,
      exportId,
      documentTitle,
      filename: safeFilename,
      sizeBytes: buffer.length,
      pdfBase64: buffer.toString('base64'),
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to generate PDF document.' });
  }
});

/**
 * POST /api/export/pdf/download
 * Streams the generated PDF directly as a binary attachment.
 */
exportRouter.post('/pdf/download', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { exportType, targetId, options } = req.body;

    if (!exportType || !targetId) {
      return res.status(400).json({ error: 'exportType and targetId are required.' });
    }

    const { buffer, documentTitle } = await generateDocumentBuffer(
      userId,
      exportType,
      targetId,
      options || {}
    );

    const safeFilename = `${sanitizeFilename(documentTitle).replace(/\s+/g, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.send(buffer);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to download PDF.' });
  }
});

/**
 * GET /api/export/history
 * Lists user export history.
 */
exportRouter.get('/history', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const history = exportRepository.findByUser(userId, 30);
    return res.json({ history, count: history.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch export history.' });
  }
});

/**
 * DELETE /api/export/:id
 * Removes an export audit entry.
 */
exportRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const deleted = exportRepository.delete(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Export entry not found or access denied.' });
    }
    return res.json({ success: true, message: 'Export history entry removed.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete export history entry.' });
  }
});

