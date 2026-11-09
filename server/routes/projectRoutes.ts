import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { projectService } from '../services/projectService';
import { savedOutputRepository } from '../repositories/savedOutputRepository';

export const projectRouter = Router();

// Protect all project routes with authentication
projectRouter.use(requireAuth);

// GET /api/projects - List with search, filter, sort
projectRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { search, category, status, semester, sortBy, sortOrder } = req.query;

    const projects = projectService.list(userId, {
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' ? category : undefined,
      status: typeof status === 'string' ? status : undefined,
      semester: typeof semester === 'string' ? semester : undefined,
      sortBy: (sortBy === 'title' || sortBy === 'created_at' || sortBy === 'year') ? sortBy : 'updated_at',
      sortOrder: sortOrder === 'ASC' ? 'ASC' : 'DESC',
    });

    return res.json({ projects, count: projects.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch projects.' });
  }
});

// POST /api/projects - Create project
projectRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = projectService.create(userId, req.body);
    return res.status(201).json({ project });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create project.' });
  }
});

// GET /api/projects/:id - Get project with its notes and linked AI outputs
projectRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = projectService.getById(userId, req.params.id);
    const notes = projectService.getNotes(userId, req.params.id);
    const savedOutputs = savedOutputRepository.findByUser(userId, { projectId: req.params.id });

    return res.json({ project, notes, savedOutputs });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Project not found.' });
  }
});

// PUT /api/projects/:id - Update project
projectRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = projectService.update(userId, req.params.id, req.body);
    return res.json({ project });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: err.message || 'Failed to update project.' });
  }
});

// DELETE /api/projects/:id - Delete project
projectRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    projectService.delete(userId, req.params.id);
    return res.json({ success: true, message: 'Project deleted successfully.' });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Failed to delete project.' });
  }
});

// Notes APIs
// GET /api/projects/:id/notes - Get all notes for project
projectRouter.get('/:id/notes', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notes = projectService.getNotes(userId, req.params.id);
    return res.json({ notes });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Failed to fetch notes.' });
  }
});

// POST /api/projects/:id/notes - Add a note to project
projectRouter.post('/:id/notes', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { content, author } = req.body;
    const note = projectService.addNote(userId, req.params.id, content, author);
    return res.status(201).json({ note });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to add note.' });
  }
});

// PUT /api/projects/:id/notes/:noteId - Update a note
projectRouter.put('/:id/notes/:noteId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { content } = req.body;
    const note = projectService.updateNote(userId, req.params.id, req.params.noteId, content);
    return res.json({ note });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update note.' });
  }
});

// DELETE /api/projects/:id/notes/:noteId - Delete a note
projectRouter.delete('/:id/notes/:noteId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    projectService.deleteNote(userId, req.params.id, req.params.noteId);
    return res.json({ success: true, message: 'Note deleted successfully.' });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Failed to delete note.' });
  }
});
