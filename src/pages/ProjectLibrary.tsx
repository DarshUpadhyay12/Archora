import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  FileText, 
  Upload, 
  LayoutGrid, 
  List, 
  MapPin, 
      Layers,
  Sparkles,
  ArrowLeft,
    Compass,
      HelpCircle,
    BookOpen,
  MessageSquare,
  Download,
  Eye,
  Image as ImageIcon,
  UploadCloud
} from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { PdfExportModal } from '@/components/common/PdfExportModal';
import { FormField } from '@/components/common/FormField';
import { showToast } from '@/components/common/Toast';
import { storageService } from '@/services/storageService';
import { apiClient, ProjectNoteResponse, SavedOutputResponse, FileResponse } from '@/services/apiClient';
import { Project, ProjectCategory } from '@/types';
import { GENZ_VOICE } from '@/config/genzVoice';

export const ProjectLibrary: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Projects list and loading states
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSemester, setSelectedSemester] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'recent' | 'newest' | 'oldest' | 'title'>('recent');

  // Modal and details states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [activeDetailProject, setActiveDetailProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'site' | 'ai' | 'notes' | 'sheets'>('overview');

  // Project Notes in SQLite
  const [projectNotes, setProjectNotes] = useState<ProjectNoteResponse[]>([]);
  const [savedAiOutputs, setSavedAiOutputs] = useState<SavedOutputResponse[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [selectedAiOutputToView, setSelectedAiOutputToView] = useState<SavedOutputResponse | null>(null);
  
  // Project Files / Sheets state in SQLite
  const [projectFiles, setProjectFiles] = useState<FileResponse[]>([]);
  const [isUploadingSheet, setIsUploadingSheet] = useState(false);
  const [sheetCategory, setSheetCategory] = useState('Floor Plans');
  const [sheetPreviewFile, setSheetPreviewFile] = useState<FileResponse | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<FileResponse | null>(null);
  const sheetFileInputRef = useRef<HTMLInputElement>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Form fields for Create / Edit (All 15 fields)
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ProjectCategory>('Studio');
  const [formTypology, setFormTypology] = useState('');
  const [formSemester, setFormSemester] = useState('Semester 7');
  const [formSubject, setFormSubject] = useState('');
  const [formYear, setFormYear] = useState<number>(2026);
  const [formLocation, setFormLocation] = useState('');
  const [formDimensions, setFormDimensions] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formStyle, setFormStyle] = useState('');
  const [formStatus, setFormStatus] = useState<'In Progress' | 'Completed' | 'Review Ready'>('In Progress');
  const [formStartDate, setFormStartDate] = useState('');
  const [formCompletionDate, setFormCompletionDate] = useState('');
  const [formDesignReqs, setFormDesignReqs] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const categories: (ProjectCategory | 'All')[] = ['All', 'Studio', 'Academic', 'Thesis', 'Competition', 'Personal'];
  const semesters: string[] = ['All', 'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8', 'Semester 9', 'Semester 10', 'Thesis'];
  const statuses: string[] = ['All', 'In Progress', 'Review Ready', 'Completed'];

  // Fetch projects from backend SQLite database
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const serverSort = sortBy === 'title' ? 'title' : sortBy === 'oldest' ? 'created_at' : 'updated_at';
      const serverOrder = sortBy === 'oldest' ? 'ASC' : 'DESC';

      const loaded = await storageService.fetchProjectsServer({
        search: searchQuery.trim() || undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        semester: selectedSemester !== 'All' ? selectedSemester : undefined,
        sortBy: serverSort,
        sortOrder: serverOrder,
      });

      setProjects(loaded);

      // Check if URL has ?id=...
      const idParam = searchParams.get('id');
      if (idParam) {
        const found = loaded.find((p) => p.id === idParam);
        if (found) {
          openProjectDetail(found);
        }
      }
    } catch (err: any) {
      console.error('[ProjectLibrary] Load failed:', err);
      showToast({ type: 'error', title: 'Load Failed', message: 'Could not fetch studio projects from database.' });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedSemester, selectedStatus, sortBy, searchParams]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Open Project Details and load linked SQLite notes & AI outputs
  const openProjectDetail = async (project: Project) => {
    setActiveDetailProject(project);
    setDetailTab('overview');
    setSearchParams({ id: project.id });

    try {
      const detailRes = await apiClient.getProjectById(project.id);
      setProjectNotes(detailRes.notes || []);
      setSavedAiOutputs(detailRes.savedOutputs || []);

      try {
        const filesRes = await apiClient.getFiles({ projectId: project.id });
        setProjectFiles(filesRes.files || []);
      } catch (err) {
        console.warn('[ProjectLibrary] Failed to load project files:', err);
      }
    } catch (e) {
      console.warn('[ProjectLibrary] Could not fetch detailed notes & outputs:', e);
    }
  };

  const closeProjectDetail = () => {
    setActiveDetailProject(null);
    setSearchParams({});
  };

  // Open Create Modal
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleUploadProjectSheet = async (files: FileList | File[]) => {
    if (!activeDetailProject || files.length === 0) return;
    setIsUploadingSheet(true);
    try {
      const res = await apiClient.uploadFiles(Array.from(files), {
        projectId: activeDetailProject.id,
        category: sheetCategory,
      });
      showToast({
        type: 'success',
        title: 'Sheet Uploaded',
        message: `Archived ${res.count} drawing(s) to project storage.`,
      });
      const updated = await apiClient.getFiles({ projectId: activeDetailProject.id });
      setProjectFiles(updated.files || []);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: err.message || 'Could not archive sheet.',
      });
    } finally {
      setIsUploadingSheet(false);
    }
  };

  const handleDeleteSheet = async () => {
    if (!sheetToDelete || !activeDetailProject) return;
    try {
      await apiClient.deleteFile(sheetToDelete.id);
      showToast({
        type: 'info',
        title: 'Drawing Removed',
        message: `"${sheetToDelete.original_filename}" has been deleted.`,
      });
      setSheetToDelete(null);
      const updated = await apiClient.getFiles({ projectId: activeDetailProject.id });
      setProjectFiles(updated.files || []);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not remove drawing.',
      });
    }
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setFormTitle('');
    setFormCategory('Studio');
    setFormTypology('Cultural & Civic');
    setFormSemester('Semester 7');
    setFormSubject('Architectural Design VII');
    setFormYear(2026);
    setFormLocation('');
    setFormDimensions('');
    setFormArea('');
    setFormStyle('Contemporary Vernacular');
    setFormStatus('In Progress');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormCompletionDate('');
    setFormDesignReqs('');
    setFormDescription('');
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal with pre-filled fields
  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setFormTitle(proj.title);
    setFormCategory(proj.category);
    setFormTypology(proj.typology);
    setFormSemester(proj.semester);
    setFormSubject(proj.subject || '');
    setFormYear(proj.year || 2026);
    setFormLocation(proj.siteLocation);
    setFormDimensions(proj.siteDimensions || '');
    setFormArea(proj.siteArea);
    setFormStyle(proj.architecturalStyle || '');
    setFormStatus(proj.status);
    setFormStartDate(proj.startDate || '');
    setFormCompletionDate(proj.expectedCompletionDate || '');
    setFormDesignReqs(proj.designRequirements || '');
    setFormDescription(proj.description);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Validate form
  const validateForm = () => {
    const errs: { [key: string]: string } = {};
    if (!formTitle.trim()) {
      errs.title = 'Project title is required.';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Save Project (Create or Update in SQLite)
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSaving) return;

    setIsSaving(true);
    try {
      if (editingProject) {
        // Update existing project
        const updated = await storageService.updateProjectServer(editingProject.id, {
          title: formTitle.trim(),
          category: formCategory,
          typology: formTypology.trim() || 'Architecture Studio',
          semester: formSemester,
          subject: formSubject.trim(),
          year: formYear,
          siteLocation: formLocation.trim() || 'Site Unspecified',
          siteDimensions: formDimensions.trim(),
          siteArea: formArea.trim() || 'Unspecified',
          architecturalStyle: formStyle.trim(),
          status: formStatus,
          startDate: formStartDate,
          expectedCompletionDate: formCompletionDate,
          designRequirements: formDesignReqs.trim(),
          description: formDescription.trim(),
        });

        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        if (activeDetailProject?.id === updated.id) {
          setActiveDetailProject(updated);
        }

        showToast({
          type: 'success',
          title: 'Project Updated',
          message: `${updated.title} changes saved to SQLite database.`,
        });
      } else {
        // Create new project
        const created = await storageService.createProjectServer({
          title: formTitle.trim(),
          category: formCategory,
          typology: formTypology.trim() || 'Architecture Studio',
          semester: formSemester,
          subject: formSubject.trim(),
          year: formYear,
          siteLocation: formLocation.trim() || 'Site Unspecified',
          siteDimensions: formDimensions.trim(),
          siteArea: formArea.trim() || 'Unspecified',
          architecturalStyle: formStyle.trim(),
          status: formStatus,
          startDate: formStartDate,
          expectedCompletionDate: formCompletionDate,
          designRequirements: formDesignReqs.trim(),
          description: formDescription.trim(),
          notes: ['Initial studio project brief initialized in SQLite database.'],
        });

        setProjects((prev) => [created, ...prev]);
        showToast({
          type: 'success',
          title: 'Project Created',
          message: `${created.title} recorded in your studio database.`,
        });
      }

      setIsCreateModalOpen(false);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Error',
        message: err.message || 'Could not save project to SQLite database.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete project
  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    try {
      await storageService.deleteProjectServer(projectToDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));

      if (activeDetailProject?.id === projectToDelete.id) {
        closeProjectDetail();
      }

      showToast({
        type: 'info',
        title: 'Project Deleted',
        message: `${projectToDelete.title} has been removed from database.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete project from database.',
      });
    } finally {
      setProjectToDelete(null);
    }
  };

  // Add a project note in SQLite
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailProject || !newNoteText.trim()) return;

    try {
      const res = await apiClient.addProjectNote(activeDetailProject.id, newNoteText.trim(), 'Studio Architect');
      setProjectNotes((prev) => [res.note, ...prev]);
      setNewNoteText('');
      showToast({ type: 'success', title: 'Note Recorded', message: 'Studio note saved in SQLite.' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Note Failed', message: err.message || 'Could not save note.' });
    }
  };

  // Edit a project note in SQLite
  const handleUpdateNote = async (noteId: string) => {
    if (!activeDetailProject || !editingNoteContent.trim()) return;

    try {
      const res = await apiClient.updateProjectNote(activeDetailProject.id, noteId, editingNoteContent.trim());
      setProjectNotes((prev) => prev.map((n) => (n.id === noteId ? res.note : n)));
      setEditingNoteId(null);
      setEditingNoteContent('');
      showToast({ type: 'success', title: 'Note Updated', message: 'Critique note updated.' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Update Failed', message: err.message || 'Could not update note.' });
    }
  };

  // Delete a project note from SQLite
  const handleDeleteNote = async (noteId: string) => {
    if (!activeDetailProject) return;

    try {
      await apiClient.deleteProjectNote(activeDetailProject.id, noteId);
      setProjectNotes((prev) => prev.filter((n) => n.id !== noteId));
      showToast({ type: 'info', title: 'Note Removed', message: 'Note deleted from project.' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: err.message || 'Could not delete note.' });
    }
  };

  // Navigate to AI tools with this project's parameters
  const handleNavigateToConceptGen = () => {
    if (!activeDetailProject) return;
    const query = new URLSearchParams({
      projectId: activeDetailProject.id,
      title: activeDetailProject.title,
      typology: activeDetailProject.typology,
      location: activeDetailProject.siteLocation,
      style: activeDetailProject.architecturalStyle || '',
    });
    navigate(`/concepts?${query.toString()}`);
  };

  const handleNavigateToPortfolioJury = () => {
    if (!activeDetailProject) return;
    const query = new URLSearchParams({
      projectId: activeDetailProject.id,
      title: activeDetailProject.title,
      details: `${activeDetailProject.typology} in ${activeDetailProject.siteLocation}. ${activeDetailProject.description}`,
    });
    navigate(`/portfolio?${query.toString()}`);
  };

  return (
    <div className="relative min-h-screen py-12 lg:py-20 overflow-hidden">
      {/* Background Architectural Illustration: Venetian Canal with stone bridges & arches */}
      <ArchitectureBackground
        imageSrc="/images/architecture/projects_feathered.png"
        fallbackSrc="/images/architecture/projects_hero_bg.jpg"
        alt="Architectural pen and ink etching of Venetian Grand Canal with stone bridges"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* VIEW 1: DEDICATED PROJECT DETAILS VIEW */}
        {activeDetailProject ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Navigation & Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl glass-panel shadow-glass">
              <button
                onClick={closeProjectDetail}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-espresso hover:text-chocolate transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Project Library</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPdfModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-espresso text-cream text-xs font-medium hover:bg-chocolate transition-colors shadow-arch-sm"
                  title="Export architectural PDF dossier"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF Dossier</span>
                </button>
                <button
                  onClick={() => openEditModal(activeDetailProject)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-archBorder text-xs font-medium text-ink hover:bg-beige/40 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 text-espresso" />
                  <span>Edit Project</span>
                </button>
                <button
                  onClick={() => setProjectToDelete(activeDetailProject)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 hover:bg-rose-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Project Header Hero Card */}
            <div className="rounded-3xl glass-panel shadow-glass p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-full bg-cream border border-archBorder text-[11px] font-mono font-semibold text-espresso">
                  {activeDetailProject.semester}
                </span>
                <span className="px-3 py-1 rounded-full bg-cream border border-archBorder text-[11px] font-mono text-ink">
                  {activeDetailProject.category}
                </span>
                <span className={`px-3 py-1 rounded-full text-[11px] font-mono font-medium ${
                  activeDetailProject.status === 'Completed'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : activeDetailProject.status === 'Review Ready'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  ● {activeDetailProject.status}
                </span>
                {activeDetailProject.subject && (
                  <span className="px-3 py-1 rounded-full bg-beige/40 border border-archBorder/60 text-[11px] font-mono text-taupe">
                    {activeDetailProject.subject}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h1 className="text-3xl sm:text-4xl font-serif font-medium text-ink">
                  {activeDetailProject.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-taupe pt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-espresso" />
                    {activeDetailProject.siteLocation}
                  </span>
                  <span>•</span>
                  <span>{activeDetailProject.typology}</span>
                  {activeDetailProject.siteArea && (
                    <>
                      <span>•</span>
                      <span>Area: {activeDetailProject.siteArea}</span>
                    </>
                  )}
                  {activeDetailProject.siteDimensions && (
                    <>
                      <span>•</span>
                      <span>Footprint: {activeDetailProject.siteDimensions}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Navigation Tabs inside Project Detail */}
              <div className="flex border-b border-archBorder/60 pt-4 overflow-x-auto gap-2">
                {[
                  { id: 'overview', label: '1. Overview & Brief', icon: BookOpen },
                  { id: 'site', label: '2. Site & Requirements', icon: Compass },
                  { id: 'ai', label: '3. AI Intelligence & Outputs', icon: Sparkles },
                  { id: 'notes', label: `4. Studio Notes (${projectNotes.length})`, icon: MessageSquare },
                  { id: 'sheets', label: '5. Drawings & Files', icon: Layers },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = detailTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setDetailTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'border-espresso text-espresso bg-cream font-bold'
                          : 'border-transparent text-ink-muted hover:text-ink hover:bg-cream/40'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB 1: OVERVIEW & BRIEF */}
            {detailTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                <div className="lg:col-span-8 space-y-6">
                  <div className="rounded-3xl bg-cream-light/95 border border-archBorder p-6 shadow-arch-sm space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                      Project Synopsis & Architectural Brief
                    </h3>
                    <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line font-sans">
                      {activeDetailProject.description || 'No detailed brief has been recorded yet. Click "Edit Project" to add studio objectives and scope.'}
                    </p>
                  </div>

                  {activeDetailProject.designRequirements && (
                    <div className="rounded-3xl bg-cream-light/95 border border-archBorder p-6 shadow-arch-sm space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                        Core Program & Design Requirements
                      </h3>
                      <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
                        {activeDetailProject.designRequirements}
                      </p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 space-y-6">
                  {/* Timeline & Metadata */}
                  <div className="rounded-3xl bg-cream-light/95 border border-archBorder p-6 shadow-arch-sm space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                      Studio Timeline & Status
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between py-1.5 border-b border-archBorder/40">
                        <span className="text-taupe">Start Date:</span>
                        <span className="font-mono text-ink">{activeDetailProject.startDate || 'Unspecified'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-archBorder/40">
                        <span className="text-taupe">Target Completion:</span>
                        <span className="font-mono text-ink">{activeDetailProject.expectedCompletionDate || 'Unspecified'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-archBorder/40">
                        <span className="text-taupe">Academic Year:</span>
                        <span className="font-mono text-ink">{activeDetailProject.year}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-archBorder/40">
                        <span className="text-taupe">Style:</span>
                        <span className="font-medium text-ink">{activeDetailProject.architecturalStyle || 'Regionalist'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-taupe">Database Record:</span>
                        <span className="font-mono text-[11px] text-emerald-800">Persistent in SQLite</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Quick Launch */}
                  <div className="rounded-3xl bg-espresso text-cream p-6 shadow-arch-md space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-beige">
                      <Sparkles className="w-4 h-4" />
                      <span>Studio Intelligence</span>
                    </div>
                    <p className="text-xs text-beige/80 leading-relaxed">
                      Generate climate-responsive concepts or prepare jury viva defenses with this project pre-loaded.
                    </p>
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handleNavigateToConceptGen}
                        className="w-full py-2.5 px-4 rounded-xl bg-cream text-espresso text-xs font-semibold hover:bg-parchment transition-colors text-center"
                      >
                        Generate Design Concept →
                      </button>
                      <button
                        onClick={handleNavigateToPortfolioJury}
                        className="w-full py-2 px-4 rounded-xl border border-beige/40 text-cream text-xs font-medium hover:bg-white/10 transition-colors text-center"
                      >
                        Prepare Jury Viva Defense →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SITE & REQUIREMENTS */}
            {detailTab === 'site' && (
              <div className="rounded-3xl bg-cream-light/95 border border-archBorder p-6 sm:p-8 shadow-arch-sm space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-2xl bg-cream border border-archBorder/70 space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-taupe">Geographic Location</span>
                    <p className="text-sm font-semibold text-ink">{activeDetailProject.siteLocation}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-cream border border-archBorder/70 space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-taupe">Site Footprint Dimensions</span>
                    <p className="text-sm font-semibold text-ink">{activeDetailProject.siteDimensions || 'Not recorded'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-cream border border-archBorder/70 space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-taupe">Total Plot Area</span>
                    <p className="text-sm font-semibold text-ink">{activeDetailProject.siteArea || 'Not recorded'}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-archBorder/40">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                    Design Constraints & Program Elements
                  </h4>
                  <div className="p-5 rounded-2xl bg-cream/70 border border-archBorder/60 text-xs sm:text-sm text-ink-muted leading-relaxed whitespace-pre-line">
                    {activeDetailProject.designRequirements || 'No specific programmatic requirements listed. Click "Edit Project" to add studio requirements.'}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: AI INTELLIGENCE & LINKED OUTPUTS */}
            {detailTab === 'ai' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-6 rounded-3xl bg-cream-light border border-archBorder shadow-arch-sm space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-espresso">
                      <Sparkles className="w-4 h-4" />
                      <span>Synthesize New Concept</span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Launch the Concept Generator with "{activeDetailProject.title}" parameters pre-loaded.
                    </p>
                    <PrimaryButton size="sm" onClick={handleNavigateToConceptGen}>
                      Generate Architectural Scheme →
                    </PrimaryButton>
                  </div>

                  <div className="p-6 rounded-3xl bg-cream-light border border-archBorder shadow-arch-sm space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-espresso">
                      <HelpCircle className="w-4 h-4" />
                      <span>Jury Defense Questions</span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Predict tough jury critique questions on seismic shear, microclimate, and spatial sequencing.
                    </p>
                    <PrimaryButton size="sm" onClick={handleNavigateToPortfolioJury}>
                      Prepare Jury Questions →
                    </PrimaryButton>
                  </div>
                </div>

                {/* Saved AI Outputs for this project in SQLite */}
                <div className="rounded-3xl bg-cream-light/95 border border-archBorder p-6 shadow-arch-sm space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                    Saved AI Outputs Linked to this Project ({savedAiOutputs.length})
                  </h3>

                  {savedAiOutputs.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-archBorder/70 rounded-2xl">
                      <p className="text-xs text-ink-muted">
                        No saved AI outputs linked to this project yet. Use the buttons above to generate concepts or jury questions and save them here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {savedAiOutputs.map((output) => (
                        <div
                          key={output.id}
                          className="p-4 rounded-2xl bg-cream border border-archBorder/60 flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-beige/60 text-espresso">
                                {output.type}
                              </span>
                              <h4 className="font-serif text-sm font-semibold text-ink">
                                {output.title}
                              </h4>
                            </div>
                            <p className="text-xs text-ink-muted line-clamp-1 max-w-xl">
                              {output.content}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setSelectedAiOutputToView(output)}
                              className="px-3 py-1.5 rounded-xl bg-beige/40 text-xs font-medium text-espresso hover:bg-beige/70 transition-colors"
                            >
                              Inspect Output
                            </button>
                            <button
                              onClick={async () => {
                                await apiClient.deleteSavedOutput(output.id);
                                setSavedAiOutputs((prev) => prev.filter((o) => o.id !== output.id));
                                showToast({ type: 'info', title: 'Output Removed', message: 'Deleted from project archive.' });
                              }}
                              className="p-1.5 text-taupe hover:text-rose-700 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: STUDIO NOTES & LOGBOOK (SQLITE CRUD) */}
            {detailTab === 'notes' && (
              <div className="rounded-3xl bg-cream-light/95 border border-archBorder p-6 sm:p-8 shadow-arch-sm space-y-6 animate-fadeIn">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                    Add Critique or Juror Note
                  </h3>
                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      type="text"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add studio critique, juror remark, or revision task..."
                      className="flex-1 bg-cream border border-archBorder/70 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
                    />
                    <PrimaryButton type="submit" size="sm">
                      Record Note
                    </PrimaryButton>
                  </form>
                </div>

                {/* Chronological Notes List */}
                <div className="space-y-3 pt-4 border-t border-archBorder/40">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-taupe">
                    Chronological Studio Notes ({projectNotes.length})
                  </h4>

                  {projectNotes.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-archBorder/60 rounded-2xl">
                      <p className="text-xs text-ink-muted">No notes recorded yet. Add your first critique note above.</p>
                    </div>
                  ) : (
                    projectNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-4 rounded-2xl bg-cream border border-archBorder/60 text-xs space-y-2"
                      >
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                              rows={3}
                              className="w-full bg-cream-light border border-archBorder rounded-xl p-3 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-espresso"
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setEditingNoteId(null)}>
                                Cancel
                              </Button>
                              <PrimaryButton size="sm" onClick={() => handleUpdateNote(note.id)}>
                                Save Update
                              </PrimaryButton>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-espresso">{note.author}</span>
                              <span className="font-mono text-[10px] text-taupe">
                                {new Date(note.created_at).toLocaleDateString()} at{' '}
                                {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-ink-muted leading-relaxed whitespace-pre-line">{note.content}</p>
                            <div className="flex justify-end gap-2 pt-1 border-t border-archBorder/30">
                              <button
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteContent(note.content);
                                }}
                                className="text-[11px] text-taupe hover:text-espresso"
                              >
                                Edit Note
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="text-[11px] text-rose-800 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: DRAWINGS & SHEETS (REAL SQLITE STORAGE) */}
            {detailTab === 'sheets' && (
              <div className="rounded-3xl bg-cream-light/95 border border-archBorder p-6 sm:p-8 shadow-arch-sm space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-archBorder/40 gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                      Project Sheets & Drawings ({projectFiles.length})
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Actual CAD drawings, plan layouts, sections, and PDF sheets stored in SQLite & local disk.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={sheetCategory}
                      onChange={(e) => setSheetCategory(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-parchment/40 border border-archBorder text-xs text-ink outline-none focus:border-espresso"
                    >
                      <option value="Floor Plans">Floor Plans</option>
                      <option value="Architectural Drawings">Architectural Drawings</option>
                      <option value="Elevations">Elevations</option>
                      <option value="Sections">Sections</option>
                      <option value="Site Analysis">Site Analysis</option>
                      <option value="Reference Images">Reference Images</option>
                      <option value="PDFs and Documents">PDFs and Documents</option>
                      <option value="Other">Other</option>
                    </select>

                    <input
                      ref={sheetFileInputRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.doc,.dwg,.dxf"
                      onChange={(e) => {
                        if (e.target.files) handleUploadProjectSheet(e.target.files);
                      }}
                      className="hidden"
                    />

                    <button
                      onClick={() => sheetFileInputRef.current?.click()}
                      disabled={isUploadingSheet}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-espresso text-cream text-xs font-medium hover:bg-chocolate transition-colors shadow-arch-sm disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingSheet ? 'Uploading...' : 'Upload Sheet'}</span>
                    </button>
                  </div>
                </div>

                {projectFiles.length === 0 ? (
                  <div className="p-8 rounded-2xl border-2 border-dashed border-archBorder text-center bg-parchment/20 space-y-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-cream border border-archBorder flex items-center justify-center text-espresso">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-ink">
                        No drawings or sheets uploaded for this project yet
                      </p>
                      <p className="text-xs text-taupe max-w-sm mx-auto">
                        Attach floor plans (.dwg, .dxf, .pdf), elevations, or site study sheets directly to this studio workspace.
                      </p>
                    </div>
                    <button
                      onClick={() => sheetFileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-cream border border-archBorder text-xs font-semibold text-espresso hover:bg-beige/40 shadow-arch-sm transition-colors"
                    >
                      Choose Drawing File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {projectFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-3.5 rounded-2xl bg-cream border border-archBorder/60 flex items-center justify-between text-xs hover:border-espresso/40 transition-all shadow-arch-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-parchment/60 border border-archBorder/60 text-espresso">
                            {file.file_extension === '.pdf' ? (
                              <FileText className="w-4 h-4 text-rose-800" />
                            ) : ['.dwg', '.dxf'].includes(file.file_extension) ? (
                              <Compass className="w-4 h-4 text-emerald-800" />
                            ) : ['.jpg', '.jpeg', '.png', '.webp'].includes(file.file_extension) ? (
                              <ImageIcon className="w-4 h-4 text-amber-800" />
                            ) : (
                              <FileText className="w-4 h-4 text-sky-800" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-ink text-sm">{file.original_filename}</div>
                            <div className="text-[11px] text-taupe font-mono flex items-center gap-2 mt-0.5">
                              <span>{formatFileSize(file.file_size)}</span>
                              <span>&bull;</span>
                              <span className="text-espresso font-medium">{file.category}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSheetPreviewFile(file)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/40 transition-colors"
                            title="Preview sheet"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <a
                            href={apiClient.getFileDownloadUrl(file.id)}
                            download={file.original_filename}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/40 transition-colors"
                            title="Download original file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => setSheetToDelete(file)}
                            className="p-1.5 rounded-lg text-rose-700 hover:text-rose-900 hover:bg-rose-50 transition-colors"
                            title="Delete sheet"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: MAIN PROJECT LIBRARY DASHBOARD */
          <div className="space-y-8 animate-fadeIn">
            {/* Page Heading & Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-archBorder/50 gap-6">
              <PageHeading
                kicker={GENZ_VOICE.pageHeaders.projects.kicker}
                title={GENZ_VOICE.pageHeaders.projects.title}
                description={GENZ_VOICE.pageHeaders.projects.subtitle}
              />

              <PrimaryButton
                icon={<Plus className="w-4 h-4" />}
                onClick={openCreateModal}
                className="flex-shrink-0"
              >
                New Project
              </PrimaryButton>
            </div>

            {/* Search, Filter, and View Controls */}
            <div className="p-5 rounded-2xl glass-panel shadow-glass space-y-4">
              {/* Row 1: Search and Category Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-taupe absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects by title, location, typology, subject..."
                    className="w-full bg-cream-light border border-archBorder/60 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
                  />
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-espresso text-cream border-espresso font-semibold'
                          : 'bg-cream-light text-ink hover:bg-beige/40 border-archBorder/60'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Secondary Filters (Semester, Status, Sort, View Toggle) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-archBorder/40 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Semester Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-taupe font-medium">Semester:</span>
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value)}
                      className="bg-cream-light border border-archBorder/70 rounded-lg px-2.5 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-espresso"
                    >
                      {semesters.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-taupe font-medium">Status:</span>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="bg-cream-light border border-archBorder/70 rounded-lg px-2.5 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-espresso"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sort & Grid/List Toggle */}
                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-cream-light border border-archBorder/70 rounded-lg px-2.5 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-espresso"
                  >
                    <option value="recent">Sort: Recently Updated</option>
                    <option value="newest">Sort: Newest Created</option>
                    <option value="oldest">Sort: Oldest</option>
                    <option value="title">Sort: Title (A-Z)</option>
                  </select>

                  <div className="flex border border-archBorder/70 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 cursor-pointer ${viewMode === 'grid' ? 'bg-espresso text-cream' : 'bg-cream-light text-ink hover:bg-beige/40'}`}
                      title="Grid View"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 cursor-pointer ${viewMode === 'list' ? 'bg-espresso text-cream' : 'bg-cream-light text-ink hover:bg-beige/40'}`}
                      title="List View"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading Skeleton */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-3xl bg-cream/80 border border-archBorder p-6 space-y-4 animate-pulse">
                    <div className="h-40 bg-parchment/60 rounded-2xl" />
                    <div className="h-5 bg-beige/60 rounded w-3/4" />
                    <div className="h-3 bg-beige/40 rounded w-1/2" />
                    <div className="h-3 bg-beige/30 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              /* Architectural Empty State */
              <div className="py-16 px-4 text-center bg-cream/80 rounded-3xl border border-dashed border-archBorder/80 max-w-xl mx-auto space-y-4 shadow-arch-sm">
                <div className="w-16 h-16 rounded-full bg-cream-light border border-archBorder flex items-center justify-center mx-auto text-espresso shadow-sm">
                  <FolderKanban className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-serif text-2xl font-medium text-ink">
                    {GENZ_VOICE.emptyStates.projects.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed max-w-md mx-auto">
                    {GENZ_VOICE.emptyStates.projects.message}
                  </p>
                </div>
                <PrimaryButton icon={<Plus className="w-4 h-4" />} onClick={openCreateModal} className="mt-2">
                  {GENZ_VOICE.emptyStates.projects.action}
                </PrimaryButton>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => openProjectDetail(project)}
                    className="group cursor-pointer rounded-3xl glass-card card-3d-tilt hover:border-espresso/60 shadow-glass-card hover:shadow-glass-card-hover transition-all duration-300 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail Header */}
                      <div className="h-44 bg-parchment relative overflow-hidden">
                        <img
                          src={project.coverImage || '/images/architecture/projects_sketch.jpg'}
                          alt={project.title}
                          className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-cream/95 backdrop-blur-sm border border-archBorder/70 text-[11px] font-mono font-medium text-espresso">
                            {project.semester}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-cream/95 backdrop-blur-sm border border-archBorder/70 text-[11px] font-mono text-ink">
                            {project.category}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                            project.status === 'Completed'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : project.status === 'Review Ready'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}>
                            ● {project.status}
                          </span>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-6 space-y-2.5">
                        <h3 className="font-serif text-xl font-semibold text-ink group-hover:text-espresso transition-colors leading-snug">
                          {project.title}
                        </h3>

                        {project.subject && (
                          <div className="text-[11px] text-espresso/80 font-mono">
                            {project.subject}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-taupe">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-espresso" />
                            {project.siteLocation}
                          </span>
                          <span>•</span>
                          <span>{project.typology}</span>
                        </div>

                        <p className="text-xs text-ink-muted leading-relaxed line-clamp-2 pt-1">
                          {project.description || 'No project description added yet.'}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-3.5 border-t border-archBorder/40 bg-cream-light/60 flex items-center justify-between text-xs text-ink-muted">
                      <span className="font-mono text-[11px] text-taupe">
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditModal(project)}
                          className="p-1.5 text-taupe hover:text-espresso rounded hover:bg-beige/40 cursor-pointer"
                          title="Edit project metadata"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setProjectToDelete(project)}
                          className="p-1.5 text-taupe hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="rounded-3xl glass-panel shadow-glass overflow-hidden">
                <div className="divide-y divide-archBorder/30">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => openProjectDetail(project)}
                      className="p-5 hover:bg-cream-light cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-beige/50 text-espresso">
                            {project.semester}
                          </span>
                          <span className="font-serif text-lg font-semibold text-ink group-hover:text-espresso">
                            {project.title}
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            project.status === 'Completed'
                              ? 'bg-blue-100 text-blue-900'
                              : project.status === 'Review Ready'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted line-clamp-1 max-w-2xl">
                          {project.subject ? `${project.subject} • ` : ''}{project.siteLocation} • {project.typology} — {project.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-taupe flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="font-mono text-[11px]">{new Date(project.updatedAt).toLocaleDateString()}</span>
                        <button
                          onClick={() => openEditModal(project)}
                          className="p-1.5 text-taupe hover:text-espresso rounded hover:bg-beige/40 cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setProjectToDelete(project)}
                          className="p-1.5 text-taupe hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT PROJECT MODAL (ALL 15 FIELDS) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingProject ? 'Edit Studio Project' : 'Create New Studio Project'}
        subtitle="All fields are persisted directly to the SQLite local database."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveProject} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          {/* Row 1: Title */}
          <FormField label="Project Title / Name" error={formErrors.title} required>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Vav-Inspired Subterranean Library"
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </FormField>

          {/* Row 2: Category & Typology */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Category">
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ProjectCategory)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              >
                {categories.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Project Typology">
              <input
                type="text"
                value={formTypology}
                onChange={(e) => setFormTypology(e.target.value)}
                placeholder="e.g. Cultural / Civic / Museum"
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>
          </div>

          {/* Row 3: Semester & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Semester">
              <select
                value={formSemester}
                onChange={(e) => setFormSemester(e.target.value)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              >
                {semesters.filter((s) => s !== 'All').map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Academic Subject / Studio">
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Architectural Design VII"
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>

            <FormField label="Academic Year">
              <input
                type="number"
                value={formYear}
                onChange={(e) => setFormYear(parseInt(e.target.value) || 2026)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>
          </div>

          {/* Row 4: Location, Dimensions, Area */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Site Location">
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g. Patan, Gujarat"
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>

            <FormField label="Site Dimensions">
              <input
                type="text"
                value={formDimensions}
                onChange={(e) => setFormDimensions(e.target.value)}
                placeholder="e.g. 80m x 55m"
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>

            <FormField label="Site Area">
              <input
                type="text"
                value={formArea}
                onChange={(e) => setFormArea(e.target.value)}
                placeholder="e.g. 4,400 sq.m"
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>
          </div>

          {/* Row 5: Style, Status, Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Architectural Style">
              <input
                type="text"
                value={formStyle}
                onChange={(e) => setFormStyle(e.target.value)}
                placeholder="e.g. Contemporary Regionalist / Dravidian"
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>

            <FormField label="Status">
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              >
                <option value="In Progress">In Progress</option>
                <option value="Review Ready">Review Ready</option>
                <option value="Completed">Completed</option>
              </select>
            </FormField>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Start Date">
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>

            <FormField label="Expected Completion Date">
              <input
                type="date"
                value={formCompletionDate}
                onChange={(e) => setFormCompletionDate(e.target.value)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </FormField>
          </div>

          {/* Design Requirements */}
          <FormField label="Design Requirements & Program Constraints">
            <textarea
              value={formDesignReqs}
              onChange={(e) => setFormDesignReqs(e.target.value)}
              rows={2}
              placeholder="e.g. Passive evaporative cooling courtyard, universal accessibility ramp, local stone ashlar"
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </FormField>

          {/* Project Description */}
          <FormField label="Project Description & Studio Brief">
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
              placeholder="Outline the architectural intent, contextual dialogue, and climatic rationale..."
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-3 border-t border-archBorder/50">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <PrimaryButton type="submit" size="sm" disabled={isSaving}>
              {isSaving ? 'Saving to Database...' : editingProject ? 'Save Changes' : 'Create Project'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* SHEET PREVIEW MODAL */}
      {sheetPreviewFile && (
        <Modal
          isOpen={!!sheetPreviewFile}
          onClose={() => setSheetPreviewFile(null)}
          title={sheetPreviewFile.original_filename}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-archBorder/40">
              <span className="font-mono text-taupe">{formatFileSize(sheetPreviewFile.file_size)} &bull; {sheetPreviewFile.category}</span>
              <a
                href={apiClient.getFileDownloadUrl(sheetPreviewFile.id)}
                download={sheetPreviewFile.original_filename}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-espresso text-cream text-xs font-medium hover:bg-chocolate"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Original</span>
              </a>
            </div>

            <div className="rounded-2xl border border-archBorder bg-parchment/40 overflow-hidden min-h-[300px] flex items-center justify-center p-4">
              {['.jpg', '.jpeg', '.png', '.webp'].includes(sheetPreviewFile.file_extension) ? (
                <img
                  src={apiClient.getFilePreviewUrl(sheetPreviewFile.id)}
                  alt={sheetPreviewFile.original_filename}
                  className="max-h-[450px] w-auto object-contain rounded shadow-arch-md"
                />
              ) : sheetPreviewFile.file_extension === '.pdf' ? (
                <iframe
                  src={apiClient.getFilePreviewUrl(sheetPreviewFile.id)}
                  title={sheetPreviewFile.original_filename}
                  className="w-full h-[450px] border-0"
                />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <Compass className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif font-semibold text-lg text-ink">
                    CAD Vector File ({sheetPreviewFile.file_extension.toUpperCase()})
                  </h4>
                  <p className="text-xs text-ink-muted max-w-sm">
                    CAD and binary documents cannot be rendered directly in web view. Download to view in AutoCAD, Rhino, or Revit.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM DELETE SHEET DIALOG */}
      {sheetToDelete && (
        <ConfirmDialog
          isOpen={!!sheetToDelete}
          onClose={() => setSheetToDelete(null)}
          onConfirm={handleDeleteSheet}
          title="Delete Drawing Sheet?"
          message={`Are you sure you want to delete "${sheetToDelete.original_filename}"? This will remove the drawing file from this project and disk storage.`}
          confirmLabel="Delete Drawing"
          variant="danger"
        />
      )}

      {/* PDF EXPORT MODAL */}
      {activeDetailProject && isPdfModalOpen && (
        <PdfExportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          exportType="project_report"
          targetId={activeDetailProject.id}
          defaultTitle={activeDetailProject.title}
          defaultSubtitle={activeDetailProject.description}
          hasImages={projectFiles.length > 0}
          availableSections={[
            { id: 'description', label: 'Academic Project Description', defaultChecked: true },
            { id: 'site', label: 'Site Dimensions & Climate Context', defaultChecked: true },
            { id: 'style', label: 'Architectural Style & Tectonics', defaultChecked: true },
            { id: 'notes', label: 'Studio Critique Notes', defaultChecked: true },
          ]}
        />
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Project from Studio Database"
        message={`Are you sure you want to permanently delete "${projectToDelete?.title}"? All associated notes, drawings, and linked outputs will be removed.`}
        confirmText="Delete Project"
        variant="danger"
      />

      {/* INSPECT SAVED AI OUTPUT MODAL */}
      {selectedAiOutputToView && (
        <Modal
          isOpen={!!selectedAiOutputToView}
          onClose={() => setSelectedAiOutputToView(null)}
          title={selectedAiOutputToView.title}
          subtitle={`AI Generated Asset (${selectedAiOutputToView.type})`}
          maxWidth="2xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="p-4 rounded-2xl bg-cream border border-archBorder text-xs leading-relaxed whitespace-pre-line text-ink">
              {selectedAiOutputToView.content}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedAiOutputToView(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
