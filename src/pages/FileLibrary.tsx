import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Folder,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Compass,
  File,
  Search,
  Filter,
  Eye,
  Download,
  Edit2,
  Trash2,
  LayoutGrid,
  List,
  CheckCircle2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Cloud,
  ExternalLink,
  HardDrive,
  Database,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { FormField } from '@/components/common/FormField';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { LoadingState, EmptyState } from '@/components/common/LoadingAndEmpty';
import { showToast } from '@/components/common/Toast';
import {
  apiClient,
  FileResponse,
  ProjectResponse,
  StorageOverviewResponse,
  CloudSyncStatusResponse,
} from '@/services/apiClient';
import { GENZ_VOICE } from '@/config/genzVoice';

const CATEGORIES = [
  'All',
  'Architectural Drawings',
  'Floor Plans',
  'Elevations',
  'Sections',
  'Site Analysis',
  'Reference Images',
  'Material References',
  'PDFs and Documents',
  'Other',
];

const FILE_TYPE_PILLS = [
  { id: 'all', label: 'All Files' },
  { id: 'image', label: 'Images (JPG, PNG, WebP)' },
  { id: 'pdf', label: 'PDF Documents' },
  { id: 'document', label: 'Word Documents (DOCX)' },
  { id: 'drawing', label: 'Architectural Drawings (DWG, DXF)' },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const FileLibrary: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [files, setFiles] = useState<FileResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'All');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('projectId') || '');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'filename' | 'size'>(
    (searchParams.get('sort') as any) || 'newest'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals & Active File
  const [previewFile, setPreviewFile] = useState<FileResponse | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [editingFile, setEditingFile] = useState<FileResponse | null>(null);
  const [editFilename, setEditFilename] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProjectId, setEditProjectId] = useState<string>('');

  const [deleteTarget, setDeleteTarget] = useState<FileResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cloud Storage & Website Data Sync State
  const [storageOverview, setStorageOverview] = useState<StorageOverviewResponse | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatusResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState('Architectural Drawings');
  const [uploadProjectId, setUploadProjectId] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch projects for dropdowns and storage metrics
  useEffect(() => {
    apiClient
      .getProjects()
      .then((res) => setProjects(res.projects || []))
      .catch((err) => console.error('Failed to load projects:', err));
    loadStorageAndSync();
  }, []);

  const loadStorageAndSync = async () => {
    try {
      const [storageRes, syncRes] = await Promise.all([
        apiClient.getStorageSummary().catch(() => null),
        apiClient.getSyncStatus().catch(() => null),
      ]);
      if (storageRes) setStorageOverview(storageRes);
      if (syncRes) setSyncStatus(syncRes);
    } catch (e) {
      console.warn('Failed to fetch storage summary:', e);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await apiClient.triggerSyncNow();
      showToast({
        type: 'success',
        title: 'Studio Data Synchronized',
        message: `Synced ${res.totalSyncedProjects} projects, ${res.totalSyncedConversations} conversations, and ${res.totalSyncedFiles} files to Google Drive (Snapshot v${res.version}).`,
      });
      await loadStorageAndSync();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Synchronization Failed',
        message: err.message || 'Unable to synchronize website data with Google Drive.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch files based on active filters
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getFiles({
        projectId: selectedProjectId || undefined,
        category: selectedCategory,
        fileType: selectedType,
        search: searchQuery,
        sortBy,
      });
      setFiles(res.files || []);
      loadStorageAndSync();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed to load file archive',
        message: err.message || 'Could not retrieve your files from studio storage.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [selectedProjectId, selectedCategory, selectedType, searchQuery, sortBy]);

  // Sync state to URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedType !== 'all') params.set('type', selectedType);
    if (selectedCategory !== 'All') params.set('category', selectedCategory);
    if (selectedProjectId) params.set('projectId', selectedProjectId);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedType, selectedCategory, selectedProjectId, sortBy]);

  // Handle Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUploadFiles.length === 0) {
      showToast({
        type: 'error',
        title: 'No files selected',
        message: 'Please select one or more files to archive.',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const res = await apiClient.uploadFiles(
        selectedUploadFiles,
        {
          projectId: uploadProjectId || null,
          category: uploadCategory,
          description: uploadDescription,
        },
        (percent) => {
          setUploadProgress(percent);
        }
      );

      showToast({
        type: 'success',
        title: 'Files Archived Successfully',
        message: `Saved ${res.count} file(s) to persistent studio storage.`,
      });

      setIsUploadModalOpen(false);
      setSelectedUploadFiles([]);
      setUploadDescription('');
      setUploadProgress(null);
      await loadFiles();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: err.message || 'Unable to store uploaded file.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (file: FileResponse) => {
    setEditingFile(file);
    setEditFilename(file.original_filename);
    setEditCategory(file.category || 'Other');
    setEditDescription(file.description || '');
    setEditProjectId(file.project_id || '');
  };

  // Save Edit Metadata
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;

    try {
      await apiClient.updateFile(editingFile.id, {
        original_filename: editFilename,
        category: editCategory,
        description: editDescription,
        project_id: editProjectId || null,
      });

      showToast({
        type: 'success',
        title: 'Metadata Updated',
        message: 'File details updated in SQLite storage.',
      });

      setEditingFile(null);
      await loadFiles();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update file metadata.',
      });
    }
  };

  // Delete File
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteFile(deleteTarget.id);
      showToast({
        type: 'info',
        title: 'File Removed',
        message: `"${deleteTarget.original_filename}" has been deleted.`,
      });
      setDeleteTarget(null);
      if (previewFile?.id === deleteTarget.id) {
        setPreviewFile(null);
      }
      await loadFiles();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        message: err.message || 'Failed to remove file from storage.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileIcon = (ext: string) => {
    const cleanExt = ext.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(cleanExt)) {
      return <ImageIcon className="w-5 h-5 text-amber-800" />;
    }
    if (cleanExt === '.pdf') {
      return <FileText className="w-5 h-5 text-rose-800" />;
    }
    if (['.docx', '.doc'].includes(cleanExt)) {
      return <FileText className="w-5 h-5 text-sky-800" />;
    }
    if (['.dwg', '.dxf'].includes(cleanExt)) {
      return <Compass className="w-5 h-5 text-emerald-800" />;
    }
    return <File className="w-5 h-5 text-espresso" />;
  };

  const isImage = (ext: string) => ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase());
  const isPdf = (ext: string) => ext.toLowerCase() === '.pdf';
  const isCad = (ext: string) => ['.dwg', '.dxf'].includes(ext.toLowerCase());

  return (
    <div className="relative min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      <ArchitectureBackground
        imageSrc="/images/architecture/projects_feathered.png"
        fallbackSrc="/images/architecture/projects_hero_bg.jpg"
        alt="Architectural Drawings & Studio Sheets Archive"
        alignment="right"
        opacity={0.20}
      />

      {/* Header and New Upload Action */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-archBorder/50">
        <PageHeading
          kicker={GENZ_VOICE.pageHeaders.files.kicker}
          title={GENZ_VOICE.pageHeaders.files.title}
          description={GENZ_VOICE.pageHeaders.files.subtitle}
        />

        <div className="flex items-center gap-3">
          <PrimaryButton
            icon={<UploadCloud className="w-4 h-4" />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Upload Architectural Files
          </PrimaryButton>
        </div>
      </div>

      {/* Primary Cloud Storage & Low Local Storage Guardrail Card */}
      {storageOverview && (
        <div className="relative z-10 p-6 rounded-2xl glass-panel shadow-glass">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-archBorder/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 flex-shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-semibold text-ink text-sm">
                    Google Drive Primary Cloud Storage
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active Benefit</span>
                  </span>
                </div>
                <p className="text-xs text-taupe mt-0.5">
                  Designated folder: <span className="font-mono text-espresso">1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://drive.google.com/drive/folders/1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-parchment/50 hover:bg-parchment text-espresso border border-archBorder text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Google Drive Folder</span>
              </a>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
              >
                {isSyncing ? 'Syncing...' : 'Sync Studio Data'}
              </Button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="p-3.5 rounded-xl glass-card border border-archBorder/30">
              <div className="flex items-center gap-1.5 text-taupe text-[11px] mb-1">
                <Cloud className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cloud Storage</span>
              </div>
              <div className="font-mono font-semibold text-ink text-sm">
                {storageOverview.cloudFilesSizeFormatted}
              </div>
              <div className="text-[10px] text-taupe mt-0.5">
                {storageOverview.cloudFilesCount} files in Drive
              </div>
            </div>

            <div className="p-3.5 rounded-xl glass-card border border-archBorder/30">
              <div className="flex items-center gap-1.5 text-taupe text-[11px] mb-1">
                <HardDrive className="w-3.5 h-3.5 text-blue-700" />
                <span>Local Disk Saved</span>
              </div>
              <div className="font-mono font-semibold text-emerald-800 text-sm">
                {storageOverview.savedLocalDiskFormatted}
              </div>
              <div className="text-[10px] text-taupe mt-0.5">
                Zero local duplicates
              </div>
            </div>

            <div className="p-3.5 rounded-xl glass-card border border-archBorder/30">
              <div className="flex items-center gap-1.5 text-taupe text-[11px] mb-1">
                <Database className="w-3.5 h-3.5 text-amber-700" />
                <span>Studio Database</span>
              </div>
              <div className="font-mono font-semibold text-ink text-sm">
                {storageOverview.localDatabaseFormatted}
              </div>
              <div className="text-[10px] text-taupe mt-0.5">
                Essential SQLite data only
              </div>
            </div>

            <div className="p-3 rounded-xl bg-parchment/30 border border-archBorder/40">
              <div className="flex items-center gap-1.5 text-taupe text-[11px] mb-1">
                <AlertTriangle className={`w-3.5 h-3.5 ${storageOverview.isLowDiskSpace ? 'text-amber-600' : 'text-taupe'}`} />
                <span>PC Free Space</span>
              </div>
              <div className="font-mono font-semibold text-ink text-sm flex items-center gap-1.5">
                <span>{storageOverview.freeDiskFormatted}</span>
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                Low Storage Protection Active
              </div>
            </div>
          </div>

          {/* Sync status footer */}
          {syncStatus?.syncState && (
            <div className="mt-3 pt-3 border-t border-archBorder/30 flex flex-wrap items-center justify-between text-[11px] text-taupe">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Website Data Status: <span className="font-semibold text-ink">{syncStatus.syncState.sync_status === 'synced' ? 'Synchronized with Google Drive' : syncStatus.syncState.sync_status}</span>
                </span>
                {syncStatus.syncState.last_sync_at && (
                  <span>&bull; Last synced: {formatDate(syncStatus.syncState.last_sync_at)}</span>
                )}
              </div>
              <div className="text-[10px] font-mono text-espresso/70">
                Manifest Snapshot v{syncStatus.syncState.snapshot_version || 1}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="relative z-10 p-5 rounded-2xl glass-panel shadow-glass space-y-4">
        {/* Row 1: Search, Category, Project, Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          {/* Search Input */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-taupe absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by drawing title or description..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink placeholder:text-taupe focus:border-espresso focus:ring-1 focus:ring-espresso outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-taupe hover:text-ink"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink focus:border-espresso focus:ring-1 focus:ring-espresso outline-none transition-all"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  Category: {c}
                </option>
              ))}
            </select>
          </div>

          {/* Project Association Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink focus:border-espresso focus:ring-1 focus:ring-espresso outline-none transition-all"
            >
              <option value="">All Projects</option>
              <option value="unassigned">Unassigned Studio Files</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Project: {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown & View Mode */}
          <div className="lg:col-span-2 flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-xs text-ink focus:border-espresso focus:ring-1 focus:ring-espresso outline-none transition-all"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="filename">Sort: Name (A-Z)</option>
              <option value="size">Sort: Size (Largest)</option>
            </select>

            <div className="flex items-center rounded-xl border border-archBorder p-0.5 bg-parchment/40 flex-shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-cream text-espresso shadow-arch-sm' : 'text-taupe hover:text-ink'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-cream text-espresso shadow-arch-sm' : 'text-taupe hover:text-ink'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: File Format Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-archBorder/30">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-espresso/70 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Format:</span>
          </span>
          {FILE_TYPE_PILLS.map((pill) => (
            <button
              key={pill.id}
              onClick={() => setSelectedType(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedType === pill.id
                  ? 'bg-espresso text-cream shadow-arch-sm'
                  : 'bg-cream/60 border border-archBorder/50 text-ink-muted hover:bg-beige/40'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Files Display Area */}
      <div className="relative z-10">
        {isLoading ? (
          <div className="py-24 text-center">
            <LoadingState message="Accessing architectural vault and validating SQLite metadata..." />
          </div>
        ) : files.length === 0 ? (
          <div className="py-20 bg-cream/80 backdrop-blur-md rounded-3xl border border-archBorder p-8 text-center space-y-4">
            <EmptyState
              title={
                searchQuery || selectedCategory !== 'All' || selectedType !== 'all' || selectedProjectId
                  ? 'No matching architectural files found'
                  : GENZ_VOICE.emptyStates.files.title
              }
              description={
                searchQuery || selectedCategory !== 'All' || selectedType !== 'all' || selectedProjectId
                  ? 'Try broadening your search query or resetting filters.'
                  : GENZ_VOICE.emptyStates.files.message
              }
              actionLabel={GENZ_VOICE.emptyStates.files.action}
              onAction={() => setIsUploadModalOpen(true)}
            />
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {files.map((file) => (
              <div
                key={file.id}
                className="group rounded-2xl glass-card hover:border-espresso/60 shadow-glass-card hover:shadow-glass-card-hover transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Visual Thumbnail Area */}
                <div
                  onClick={() => {
                    setPreviewFile(file);
                    setZoomLevel(1);
                  }}
                  className="relative h-44 bg-parchment/40 border-b border-archBorder/40 overflow-hidden cursor-pointer flex items-center justify-center group-hover:bg-parchment/60 transition-colors"
                >
                  {isImage(file.file_extension) ? (
                    <img
                      src={apiClient.getFilePreviewUrl(file.id)}
                      alt={file.original_filename}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : isPdf(file.file_extension) ? (
                    <div className="text-center p-4 space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-800">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                        PDF Document
                      </span>
                    </div>
                  ) : isCad(file.file_extension) ? (
                    <div className="text-center p-4 space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800">
                        <Compass className="w-6 h-6" />
                      </div>
                      <span className="inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        AutoCAD / Vector DWG
                      </span>
                    </div>
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-800">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                        {file.file_extension.replace('.', '').toUpperCase()} Document
                      </span>
                    </div>
                  )}

                  {/* Hover overlay with Quick Preview button */}
                  <div className="absolute inset-0 bg-espresso/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-cream/95 text-xs font-medium text-espresso shadow-arch-md flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </span>
                  </div>

                  {/* Category Pill Tag */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded-full bg-cream/90 backdrop-blur-sm border border-archBorder/60 text-[10px] font-medium text-espresso shadow-arch-sm">
                      {file.category}
                    </span>
                  </div>

                  {/* Cloud Storage Status Pill */}
                  {file.google_drive_file_id && (
                    <div className="absolute top-2.5 right-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600/90 text-white backdrop-blur-sm text-[10px] font-medium shadow-arch-sm flex items-center gap-1">
                        <Cloud className="w-3 h-3" />
                        <span>Drive</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Content & Metadata Area */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h4
                      title={file.original_filename}
                      className="font-serif font-semibold text-ink text-base line-clamp-1 group-hover:text-espresso transition-colors"
                    >
                      {file.original_filename}
                    </h4>

                    {file.project_title ? (
                      <p className="text-[11px] text-espresso font-medium flex items-center gap-1 line-clamp-1">
                        <Folder className="w-3 h-3 flex-shrink-0" />
                        <span>{file.project_title}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-taupe font-mono">Unassigned Studio Asset</p>
                    )}

                    {file.description && (
                      <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                        {file.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata Stats & Action Bar */}
                  <div className="pt-3 border-t border-archBorder/40 flex items-center justify-between text-[11px] text-taupe">
                    <div className="flex items-center gap-2 font-mono">
                      <span>{formatBytes(file.file_size)}</span>
                      <span>&bull;</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {file.cloud_web_view_link && (
                        <a
                          href={file.cloud_web_view_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition-colors"
                          title="Open in Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <a
                        href={apiClient.getFileDownloadUrl(file.id)}
                        download={file.original_filename}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/40 transition-colors"
                        title="Download original file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => openEditModal(file)}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/40 transition-colors"
                        title="Edit metadata & project"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(file)}
                        className="p-1.5 rounded-lg text-rose-700 hover:text-rose-900 hover:bg-rose-50 transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="rounded-2xl bg-cream border border-archBorder shadow-arch-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-archBorder bg-parchment/40 text-espresso font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">File Name</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Associated Project</th>
                    <th className="py-3.5 px-4">Format</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4">Uploaded</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-archBorder/40">
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-beige/20 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div
                          onClick={() => {
                            setPreviewFile(file);
                            setZoomLevel(1);
                          }}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <div className="p-2 rounded-xl bg-parchment/60 border border-archBorder/60 flex-shrink-0">
                            {getFileIcon(file.file_extension)}
                          </div>
                          <div>
                            <div className="font-medium text-ink group-hover:text-espresso transition-colors text-sm">
                              {file.original_filename}
                            </div>
                            {file.description && (
                              <div className="text-[11px] text-ink-muted line-clamp-1 max-w-md">
                                {file.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-ink-muted">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-full bg-parchment/70 border border-archBorder/60 text-[10px] font-medium text-espresso">
                            {file.category}
                          </span>
                          {file.google_drive_file_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-medium text-emerald-800">
                              <Cloud className="w-2.5 h-2.5" />
                              <span>Drive</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-ink">
                        {file.project_title ? (
                          <span className="font-medium text-espresso flex items-center gap-1.5">
                            <Folder className="w-3.5 h-3.5 text-taupe flex-shrink-0" />
                            <span>{file.project_title}</span>
                          </span>
                        ) : (
                          <span className="text-taupe font-mono">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-espresso">
                        {file.file_extension.replace('.', '')}
                      </td>
                      <td className="py-3 px-4 font-mono text-ink-muted">
                        {formatBytes(file.file_size)}
                      </td>
                      <td className="py-3 px-4 text-taupe font-mono">
                        {formatDate(file.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {file.cloud_web_view_link && (
                            <a
                              href={file.cloud_web_view_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition-colors"
                              title="Open in Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setPreviewFile(file);
                              setZoomLevel(1);
                            }}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/40 transition-colors"
                            title="Preview file"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={apiClient.getFileDownloadUrl(file.id)}
                            download={file.original_filename}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/40 transition-colors"
                            title="Download original file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => openEditModal(file)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-espresso hover:bg-beige/40 transition-colors"
                            title="Edit metadata"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(file)}
                            className="p-1.5 rounded-lg text-rose-700 hover:text-rose-900 hover:bg-rose-50 transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: UPLOAD ARCHITECTURAL FILES MODAL                      */}
      {/* ============================================================== */}
      {isUploadModalOpen && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => {
            if (!isUploading) setIsUploadModalOpen(false);
          }}
          title="Upload Architectural Files"
          maxWidth="lg"
        >
          <form onSubmit={handleUploadSubmit} className="space-y-5">
            {/* Dropzone Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  setSelectedUploadFiles(Array.from(e.dataTransfer.files));
                }
              }}
              className="border-2 border-dashed border-archBorder hover:border-espresso/80 rounded-2xl p-8 text-center bg-parchment/30 hover:bg-parchment/50 transition-all cursor-pointer space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.doc,.dwg,.dxf"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedUploadFiles(Array.from(e.target.files));
                  }
                }}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-cream border border-archBorder flex items-center justify-center text-espresso shadow-arch-sm">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-ink">
                  Click to select files, or drag and drop drawings here
                </p>
                <p className="text-xs text-taupe">
                  Supports Images (JPG, PNG, WebP), PDFs, DOCX, and Vector Drawings (DWG, DXF) up to 50 MB
                </p>
              </div>

              {selectedUploadFiles.length > 0 && (
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selectedUploadFiles.length} file(s) ready for upload</span>
                  </span>
                </div>
              )}
            </div>

            {/* Cloud Storage Notice */}
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>
                  <strong>Google Drive Primary Storage:</strong> Files upload directly to your connected Drive folder (<span className="font-mono">1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl</span>) to conserve local PC storage.
                </span>
              </div>
            </div>

            {/* List of Selected Files */}
            {selectedUploadFiles.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-2 p-3 rounded-xl bg-cream border border-archBorder/60">
                {selectedUploadFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-parchment/40"
                  >
                    <span className="font-medium text-ink truncate max-w-sm">
                      {f.name}
                    </span>
                    <span className="font-mono text-taupe">{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Architectural Category" required>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Associate with Project (Optional)">
                <select
                  value={uploadProjectId}
                  onChange={(e) => setUploadProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso"
                >
                  <option value="">Unassigned Studio Asset</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Description or Scope Notes">
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={2}
                placeholder="e.g. 1:100 Scale schematic floor plan with courtyard ventilation nodes..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso resize-none"
              />
            </FormField>

            {/* Upload Progress Bar */}
            {uploadProgress !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-espresso">
                  <span>Archiving to Local Storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-parchment overflow-hidden border border-archBorder/60">
                  <div
                    className="h-full bg-espresso transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-archBorder/40">
              <Button
                variant="secondary"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <PrimaryButton
                type="submit"
                disabled={isUploading || selectedUploadFiles.length === 0}
              >
                {isUploading ? 'Uploading to Studio...' : 'Archive Files'}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: FILE PREVIEW & INSPECTION MODAL                      */}
      {/* ============================================================== */}
      {previewFile && (
        <Modal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          title={previewFile.original_filename}
          maxWidth="xl"
        >
          <div className="space-y-5">
            {/* Toolbar: Metadata & Zoom controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-archBorder/40 text-xs">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full bg-parchment border border-archBorder text-espresso font-medium">
                  {previewFile.category}
                </span>
                <span className="font-mono text-taupe">{formatBytes(previewFile.file_size)}</span>
                {previewFile.project_title && (
                  <span className="text-ink-muted flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5 text-taupe" />
                    <span>{previewFile.project_title}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isImage(previewFile.file_extension) && (
                  <div className="flex items-center gap-1 bg-parchment/60 rounded-xl p-0.5 border border-archBorder">
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                      className="p-1.5 rounded text-espresso hover:bg-cream"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-mono text-[11px] text-espresso">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                      className="p-1.5 rounded text-espresso hover:bg-cream"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomLevel(1)}
                      className="p-1.5 rounded text-espresso hover:bg-cream"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <a
                  href={apiClient.getFileDownloadUrl(previewFile.id)}
                  download={previewFile.original_filename}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-espresso text-cream text-xs font-medium hover:bg-chocolate transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Original</span>
                </a>
              </div>
            </div>

            {/* Viewer Canvas */}
            <div className="rounded-2xl border border-archBorder bg-parchment/40 overflow-hidden min-h-[420px] flex items-center justify-center relative">
              {isImage(previewFile.file_extension) ? (
                <div className="max-h-[560px] overflow-auto w-full p-4 flex items-center justify-center">
                  <img
                    src={apiClient.getFilePreviewUrl(previewFile.id)}
                    alt={previewFile.original_filename}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    className="max-h-[500px] w-auto object-contain transition-transform duration-200 rounded shadow-arch-md"
                  />
                </div>
              ) : isPdf(previewFile.file_extension) ? (
                <iframe
                  src={apiClient.getFilePreviewUrl(previewFile.id)}
                  title={previewFile.original_filename}
                  className="w-full h-[550px] border-0"
                />
              ) : isCad(previewFile.file_extension) ? (
                <div className="p-8 max-w-md text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shadow-arch-sm">
                    <Compass className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-serif font-semibold text-xl text-ink">
                      Vector Drawing ({previewFile.file_extension.toUpperCase()})
                    </h4>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      AutoCAD and DXF formats contain raw binary vector geometries and cannot be safely rendered directly in the web browser.
                    </p>
                    <p className="text-xs text-emerald-900 font-medium pt-1">
                      Download the original file below to inspect layers, lineweights, and scales in AutoCAD, Rhino, Revit, or Vectorworks.
                    </p>
                  </div>
                  <div className="pt-2">
                    <a
                      href={apiClient.getFileDownloadUrl(previewFile.id)}
                      download={previewFile.original_filename}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-espresso text-cream text-xs font-semibold hover:bg-chocolate transition-colors shadow-arch-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download {previewFile.original_filename}</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-8 max-w-md text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-800 shadow-arch-sm">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-serif font-semibold text-xl text-ink">
                      Word Document ({previewFile.file_extension.toUpperCase()})
                    </h4>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Document stored securely in your studio archive. Download to open in Microsoft Word or Pages.
                    </p>
                  </div>
                  <div className="pt-2">
                    <a
                      href={apiClient.getFileDownloadUrl(previewFile.id)}
                      download={previewFile.original_filename}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-espresso text-cream text-xs font-semibold hover:bg-chocolate transition-colors shadow-arch-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Document</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Description Rationale */}
            {previewFile.description && (
              <div className="p-4 rounded-xl bg-cream border border-archBorder/60 space-y-1 text-xs">
                <span className="font-semibold text-espresso uppercase tracking-wider text-[10px]">
                  Description & Scope
                </span>
                <p className="text-ink-muted leading-relaxed">{previewFile.description}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: EDIT FILE METADATA MODAL                             */}
      {/* ============================================================== */}
      {editingFile && (
        <Modal
          isOpen={!!editingFile}
          onClose={() => setEditingFile(null)}
          title="Edit File Metadata"
          maxWidth="md"
        >
          <form onSubmit={handleEditSave} className="space-y-4">
            <FormField label="Display Filename" required>
              <input
                type="text"
                value={editFilename}
                onChange={(e) => setEditFilename(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso"
                required
              />
            </FormField>

            <FormField label="Category">
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso"
              >
                {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Assign to Project">
              <select
                value={editProjectId}
                onChange={(e) => setEditProjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso"
              >
                <option value="">Unassigned Studio Asset</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Description">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                placeholder="Notes on scale, orientation, climate rationale..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso resize-none"
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-archBorder/40">
              <Button variant="secondary" onClick={() => setEditingFile(null)}>
                Cancel
              </Button>
              <PrimaryButton type="submit">Save Changes</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* DIALOG: CONFIRM DELETE FILE                                   */}
      {/* ============================================================== */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete File from Studio Storage?"
          message={`Are you sure you want to permanently remove "${deleteTarget.original_filename}"? This will delete the SQLite record and the physical file from disk storage.`}
          confirmLabel={isDeleting ? 'Deleting...' : 'Delete File'}
          variant="danger"
        />
      )}
    </div>
  );
};
