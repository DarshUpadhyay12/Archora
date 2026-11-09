import crypto from 'crypto';
import { projectRepository, ProjectQueryOptions } from '../repositories/projectRepository';
import { ProjectRecord, ProjectNoteRecord } from '../types/db';

export interface CreateProjectDTO {
  title: string;
  category?: string;
  semester?: string;
  subject?: string;
  year?: number;
  site_location?: string;
  site_dimensions?: string;
  site_area?: string;
  typology?: string;
  description?: string;
  architectural_style?: string;
  start_date?: string;
  expected_completion_date?: string;
  design_requirements?: string;
  notes?: string[];
  status?: 'In Progress' | 'Completed' | 'Review Ready';
}

export const projectService = {
  create(userId: string, data: CreateProjectDTO): ProjectRecord {
    if (!data.title || !data.title.trim()) {
      throw new Error('Project title is required.');
    }

    const projectId = `proj_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return projectRepository.create({
      id: projectId,
      user_id: userId,
      title: data.title.trim(),
      category: data.category,
      semester: data.semester,
      subject: data.subject,
      year: data.year,
      site_location: data.site_location,
      site_dimensions: data.site_dimensions,
      site_area: data.site_area,
      typology: data.typology,
      description: data.description,
      architectural_style: data.architectural_style,
      start_date: data.start_date,
      expected_completion_date: data.expected_completion_date,
      design_requirements: data.design_requirements,
      notes: data.notes,
      status: data.status,
    });
  },

  list(userId: string, options: ProjectQueryOptions = {}): ProjectRecord[] {
    return projectRepository.findAll(userId, options);
  },

  getById(userId: string, projectId: string): ProjectRecord {
    const project = projectRepository.findById(projectId, userId);
    if (!project) {
      throw new Error('Project not found or you do not have permission to access it.');
    }
    return project;
  },

  update(userId: string, projectId: string, updates: Partial<CreateProjectDTO>): ProjectRecord {
    const updated = projectRepository.update(projectId, userId, updates);
    if (!updated) {
      throw new Error('Project not found or you do not have permission to modify it.');
    }
    return updated;
  },

  delete(userId: string, projectId: string): boolean {
    const success = projectRepository.delete(projectId, userId);
    if (!success) {
      throw new Error('Project not found or already deleted.');
    }
    return true;
  },

  // Notes operations
  addNote(userId: string, projectId: string, content: string, author?: string): ProjectNoteRecord {
    if (!content || !content.trim()) {
      throw new Error('Note content cannot be empty.');
    }
    // Verify project ownership
    this.getById(userId, projectId);

    const noteId = `note_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return projectRepository.addNote({
      id: noteId,
      project_id: projectId,
      user_id: userId,
      content: content.trim(),
      author,
    });
  },

  getNotes(userId: string, projectId: string): ProjectNoteRecord[] {
    // Verify project ownership
    this.getById(userId, projectId);
    return projectRepository.getNotes(projectId, userId);
  },

  updateNote(userId: string, projectId: string, noteId: string, content: string): ProjectNoteRecord {
    if (!content || !content.trim()) {
      throw new Error('Note content cannot be empty.');
    }
    const updated = projectRepository.updateNote(noteId, projectId, userId, content);
    if (!updated) {
      throw new Error('Note not found or you do not have permission to modify it.');
    }
    return updated;
  },

  deleteNote(userId: string, projectId: string, noteId: string): boolean {
    const deleted = projectRepository.deleteNote(noteId, projectId, userId);
    if (!deleted) {
      throw new Error('Note not found or already deleted.');
    }
    return true;
  }
};
