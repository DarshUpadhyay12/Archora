import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  History, 
  Search, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  ExternalLink, 
  MessageSquare, 
  Compass, 
  Award, 
  FileText, 
  ArrowUpDown, 
  Eye,
  Calendar,
  Sparkles
} from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { PdfExportModal } from '@/components/common/PdfExportModal';
import { showToast } from '@/components/common/Toast';
import { 
  apiClient, 
  ConversationResponse, 
  SavedOutputResponse, 
  ProjectResponse 
} from '@/services/apiClient';

type HistoryCategory = 'all' | 'tutor' | 'concept' | 'jury' | 'portfolio';

interface UnifiedHistoryItem {
  id: string;
  kind: 'conversation' | 'output';
  category: HistoryCategory;
  title: string;
  subtitle?: string;
  contentSummary: string;
  projectId?: string | null;
  projectTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  rawType?: string;
  metadata?: any;
}

export const AIHistory: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeCategory, setActiveCategory] = useState<HistoryCategory>(
    (searchParams.get('category') as HistoryCategory) || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [savedOutputs, setSavedOutputs] = useState<SavedOutputResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inspector & Editing state
  const [inspectingItem, setInspectingItem] = useState<UnifiedHistoryItem | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingItem, setDeletingItem] = useState<UnifiedHistoryItem | null>(null);
  const [exportingItem, setExportingItem] = useState<UnifiedHistoryItem | null>(null);

  // Load all user history data
  const loadAllHistory = async () => {
    setIsLoading(true);
    try {
      const [convRes, outRes, projRes] = await Promise.all([
        apiClient.getConversations(),
        apiClient.getSavedOutputs(),
        apiClient.getProjects(),
      ]);
      setConversations(convRes.conversations || []);
      setSavedOutputs(outRes.outputs || []);
      setProjects(projRes.projects || []);
    } catch (e: any) {
      console.warn('[AIHistory] Could not load history from server:', e);
      showToast({ type: 'error', title: 'Data Load Issue', message: e?.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllHistory();
  }, []);

  // Update URL params when category changes
  const handleCategoryChange = (cat: HistoryCategory) => {
    setActiveCategory(cat);
    if (cat === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
  };

  // Build unified item list
  const unifiedItems: UnifiedHistoryItem[] = useMemo(() => {
    const list: UnifiedHistoryItem[] = [];

    // Map conversations (Tutor)
    for (const c of conversations) {
      list.push({
        id: c.id,
        kind: 'conversation',
        category: 'tutor',
        title: c.title,
        subtitle: c.topic ? `Topic: ${c.topic}` : 'Architectural Theory & Precedents',
        contentSummary: `${c.messages_count || 0} messages in conversation`,
        projectId: c.project_id,
        projectTitle: projects.find((p) => p.id === c.project_id)?.title || null,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        rawType: 'tutor-conversation',
      });
    }

    // Map saved outputs
    for (const o of savedOutputs) {
      let cat: HistoryCategory = 'portfolio';
      if (o.type === 'concept' || o.type === 'design-concept') {
        cat = 'concept';
      } else if (o.type === 'jury-viva-questions' || o.type === 'jury-preparation') {
        cat = 'jury';
      } else if (o.type === 'tutor-note') {
        cat = 'tutor';
      }

      let parsedMeta: any = {};
      try { parsedMeta = JSON.parse(o.metadata_json || '{}'); } catch {}

      list.push({
        id: o.id,
        kind: 'output',
        category: cat,
        title: o.title,
        subtitle: `Type: ${o.type.replace(/-/g, ' ')}`,
        contentSummary: o.content,
        projectId: o.project_id,
        projectTitle: o.project_title || projects.find((p) => p.id === o.project_id)?.title || null,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        rawType: o.type,
        metadata: parsedMeta,
      });
    }

    return list;
  }, [conversations, savedOutputs, projects]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      // Category filter
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // Project filter
      if (selectedProjectId !== 'all') {
        if (item.projectId !== selectedProjectId) return false;
      }

      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesContent = item.contentSummary.toLowerCase().includes(q);
        const matchesProject = item.projectTitle?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent && !matchesProject) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [unifiedItems, activeCategory, selectedProjectId, searchQuery, sortBy]);

  // Open item in native tool
  const handleOpenItem = (item: UnifiedHistoryItem) => {
    if (item.kind === 'conversation') {
      navigate(`/tutor?conversationId=${item.id}`);
    } else if (item.category === 'concept') {
      navigate(`/concepts?savedId=${item.id}`);
    } else {
      navigate(`/portfolio?savedId=${item.id}`);
    }
  };

  // Inline rename
  const handleSaveRename = async (item: UnifiedHistoryItem) => {
    if (!editingTitle.trim()) return;
    try {
      if (item.kind === 'conversation') {
        await apiClient.updateConversation(item.id, { title: editingTitle.trim() });
        setConversations((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, title: editingTitle.trim() } : c))
        );
      } else {
        await apiClient.updateSavedOutput(item.id, { title: editingTitle.trim() });
        setSavedOutputs((prev) =>
          prev.map((o) => (o.id === item.id ? { ...o, title: editingTitle.trim() } : o))
        );
      }
      setEditingItemId(null);
      showToast({ type: 'success', title: 'Renamed', message: 'Title updated in studio database.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Rename Failed', message: e?.message });
    }
  };

  // Associate project
  const handleAssociateProject = async (item: UnifiedHistoryItem, newProjectId: string) => {
    try {
      const pid = newProjectId || null;
      if (item.kind === 'conversation') {
        await apiClient.updateConversation(item.id, { projectId: pid });
        setConversations((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, project_id: pid } : c))
        );
      } else {
        await apiClient.updateSavedOutput(item.id, { projectId: pid });
        setSavedOutputs((prev) =>
          prev.map((o) => (o.id === item.id ? { ...o, project_id: pid } : o))
        );
      }
      showToast({
        type: 'success',
        title: 'Project Updated',
        message: pid ? 'Asset linked to project.' : 'Asset unassigned.',
      });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Link Failed', message: e?.message });
    }
  };

  // Delete
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      if (deletingItem.kind === 'conversation') {
        await apiClient.deleteConversation(deletingItem.id);
        setConversations((prev) => prev.filter((c) => c.id !== deletingItem.id));
      } else {
        await apiClient.deleteSavedOutput(deletingItem.id);
        setSavedOutputs((prev) => prev.filter((o) => o.id !== deletingItem.id));
      }
      setDeletingItem(null);
      showToast({ type: 'info', title: 'Item Deleted', message: 'Asset removed from SQLite.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: e?.message });
    }
  };

  const getCategoryIcon = (cat: HistoryCategory) => {
    switch (cat) {
      case 'tutor': return <MessageSquare className="w-4 h-4 text-espresso" />;
      case 'concept': return <Compass className="w-4 h-4 text-espresso" />;
      case 'jury': return <Award className="w-4 h-4 text-espresso" />;
      case 'portfolio': return <FileText className="w-4 h-4 text-espresso" />;
      default: return <Sparkles className="w-4 h-4 text-espresso" />;
    }
  };

  return (
    <div className="relative min-h-screen py-12 lg:py-20 overflow-hidden">
      {/* Background Architectural Illustration */}
      <ArchitectureBackground
        imageSrc="/images/architecture/projects_feathered.png"
        fallbackSrc="/images/architecture/projects_hero_bg.jpg"
        alt="Architectural pen and ink etching of Venetian Grand Canal with stone bridges"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-archBorder/50">
          <div className="max-w-2xl">
            <PageHeading
              kicker="PERSISTENT STUDIO ARCHIVE"
              title="AI History & Saved Outputs"
              description="Review, reopen, rename, and organize all your genuine Gemini tutor conversations, synthesized design concepts, and jury defense assets stored in SQLite."
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-espresso px-3 py-1.5 rounded-full bg-cream border border-archBorder shadow-arch-sm">
              {unifiedItems.length} Archived Asset{unifiedItems.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="glass-panel shadow-glass rounded-3xl p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All History' },
                { id: 'tutor', label: 'Tutor Conversations' },
                { id: 'concept', label: 'Design Concepts' },
                { id: 'jury', label: 'Jury Preparation' },
                { id: 'portfolio', label: 'Portfolio Content' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleCategoryChange(tab.id as HistoryCategory)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                    activeCategory === tab.id
                      ? 'bg-espresso text-cream shadow-sm'
                      : 'bg-beige/40 text-ink-muted hover:text-ink hover:bg-beige/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
              >
                {sortBy === 'newest' ? 'Newest First' : 'Oldest First'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-archBorder/30">
            {/* Search Input */}
            <div className="md:col-span-8 relative">
              <Search className="w-4 h-4 text-taupe absolute left-3.5 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history by title, content, or project..."
                className="w-full bg-cream-light border border-archBorder rounded-xl pl-10 pr-4 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              />
            </div>

            {/* Project Filter */}
            <div className="md:col-span-4">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Stream */}
        {isLoading ? (
          <div className="py-20 text-center text-sm font-serif text-ink-muted">
            Loading archived studio assets from SQLite...
          </div>
        ) : filteredItems.length === 0 ? (
          /* Clean Empty State */
          <div className="py-20 text-center space-y-4 rounded-3xl border border-dashed border-archBorder/70 bg-cream/30 p-8">
            <div className="w-14 h-14 rounded-2xl bg-cream border border-archBorder flex items-center justify-center text-espresso mx-auto shadow-arch-sm">
              <History className="w-7 h-7 text-espresso/80" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="font-serif text-2xl font-semibold text-ink">
                No History Found
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                {searchQuery || activeCategory !== 'all' || selectedProjectId !== 'all'
                  ? 'No archived items match your current filter criteria. Try resetting your search.'
                  : 'Start by asking the Architecture Tutor a question, generating a Design Concept, or preparing for your Jury Viva.'}
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button to="/tutor" variant="secondary" size="sm">
                Ask Architecture Tutor
              </Button>
              <Button to="/concepts" variant="primary" size="sm">
                Generate Concepts
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const isEditing = editingItemId === item.id;

              return (
                <div
                  key={item.id}
                  className="glass-card hover:border-espresso/60 shadow-glass-card hover:shadow-glass-card-hover rounded-3xl p-6 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header badge & Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase bg-beige/50 text-espresso">
                        {getCategoryIcon(item.category)}
                        <span>{item.category}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingItemId(item.id);
                            setEditingTitle(item.title);
                          }}
                          className="p-1.5 rounded-lg text-taupe hover:text-espresso hover:bg-beige/40 transition-colors"
                          title="Rename"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingItem(item)}
                          className="p-1.5 rounded-lg text-taupe hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title or inline rename */}
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-cream-light border border-espresso text-ink focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(item);
                            if (e.key === 'Escape') setEditingItemId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveRename(item)}
                          className="p-1 rounded text-emerald-700 hover:bg-emerald-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="p-1 rounded text-rose-700 hover:bg-rose-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h4
                          onClick={() => handleOpenItem(item)}
                          className="font-serif font-semibold text-lg text-ink hover:text-espresso cursor-pointer transition-colors leading-snug line-clamp-2"
                        >
                          {item.title}
                        </h4>
                        {item.subtitle && (
                          <span className="text-[11px] text-taupe font-mono block mt-0.5">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Content Preview */}
                    <p className="text-xs text-ink-muted leading-relaxed line-clamp-3 font-sans">
                      {item.contentSummary}
                    </p>
                  </div>

                  {/* Footer: Date, Project Selector, Open button */}
                  <div className="pt-3 border-t border-archBorder/40 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-taupe">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>

                      {/* Project Association Dropdown */}
                      <div className="flex items-center gap-1">
                        <select
                          value={item.projectId || ''}
                          onChange={(e) => handleAssociateProject(item, e.target.value)}
                          className="bg-cream-light border border-archBorder/60 rounded px-2 py-0.5 text-[10px] text-ink max-w-[120px] truncate"
                          title="Assign project"
                        >
                          <option value="">Unassigned</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setInspectingItem(item)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-archBorder/70 text-xs font-medium text-ink hover:bg-beige/30 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                      <button
                        onClick={() => handleOpenItem(item)}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-espresso text-cream text-xs font-medium hover:bg-espresso-hover transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in Tool</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Content Inspector Modal */}
      <Modal
        isOpen={!!inspectingItem}
        onClose={() => setInspectingItem(null)}
        title={inspectingItem?.title || 'Archived Content Inspector'}
        subtitle={inspectingItem?.subtitle}
        maxWidth="2xl"
      >
        {inspectingItem && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-cream border border-archBorder/50 text-xs text-ink-muted">
              <span>Category: <strong>{inspectingItem.category}</strong></span>
              <span>Project: <strong>{inspectingItem.projectTitle || 'Unassigned'}</strong></span>
              <span>Archived: <strong>{new Date(inspectingItem.createdAt).toLocaleString()}</strong></span>
            </div>

            <div className="p-5 rounded-2xl bg-cream-light border border-archBorder/60 max-h-[50vh] overflow-y-auto">
              <pre className="text-xs sm:text-sm font-sans text-ink leading-relaxed whitespace-pre-wrap">
                {inspectingItem.contentSummary}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-archBorder/40">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInspectingItem(null)}
              >
                Close
              </Button>
              <PrimaryButton
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => {
                  const item = inspectingItem;
                  setInspectingItem(null);
                  handleOpenItem(item);
                }}
              >
                Open in Full Tool
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      {/* PDF Export Modal */}
      {exportingItem && (
        <PdfExportModal
          isOpen={!!exportingItem}
          onClose={() => setExportingItem(null)}
          exportType={
            exportingItem.category === 'concept'
              ? 'concept_report'
              : exportingItem.category === 'jury'
              ? 'jury_prep'
              : exportingItem.category === 'portfolio'
              ? 'portfolio'
              : 'tutor_notes'
          }
          targetId={exportingItem.id}
          defaultTitle={exportingItem.title}
          defaultSubtitle={exportingItem.subtitle}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Archived Asset"
        message={`Are you sure you want to delete "${deletingItem?.title}"? It will be permanently removed from SQLite.`}
        confirmLabel="Delete Asset"
        isDestructive
      />
    </div>
  );
};
