import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Sparkles, 
  Bookmark, 
  Sun, 
  Trees, 
  Maximize2, 
  Edit3, 
  Copy,
  Compass,
  FileText,
  History,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronRight,
  FolderKanban
} from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { FormField } from '@/components/common/FormField';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { LoadingState } from '@/components/common/LoadingAndEmpty';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { PdfExportModal } from '@/components/common/PdfExportModal';
import { showToast } from '@/components/common/Toast';
import { aiService } from '@/services/aiService';
import { storageService } from '@/services/storageService';
import { apiClient, SavedOutputResponse, ProjectResponse } from '@/services/apiClient';
import { ConceptInput, ConceptResult } from '@/types';
import { GENZ_VOICE } from '@/config/genzVoice';

export const DesignConceptGenerator: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedProjectId = searchParams.get('projectId');

  // Available user projects for association
  const [userProjects, setUserProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(linkedProjectId || '');

  // Form input data
  const [formData, setFormData] = useState<ConceptInput>({
    projectTitle: searchParams.get('title') || '',
    projectType: searchParams.get('typology') || '',
    siteDimensions: '',
    locationClimate: searchParams.get('location') || '',
    intendedUsers: '',
    functionalRequirements: '',
    preferredStyle: searchParams.get('style') || '',
    materialPreferences: '',
    sustainabilityRequirements: '',
    additionalNotes: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ConceptResult | null>(null);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'narrative' | 'spatial' | 'materials' | 'sustainability' | 'alternatives'>('narrative');
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableNarrative, setEditableNarrative] = useState('');

  // History Drawer & Management
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [savedConcepts, setSavedConcepts] = useState<SavedOutputResponse[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [editingOutputId, setEditingOutputId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingOutputId, setDeletingOutputId] = useState<string | null>(null);

  // Load user projects for assignment
  useEffect(() => {
    apiClient.getProjects().then((res) => {
      setUserProjects(res.projects || []);
    }).catch((e) => console.warn('[ConceptGenerator] Could not load projects:', e));
  }, []);

  // Load saved concepts list
  const loadSavedConcepts = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await apiClient.getSavedOutputs({ type: 'concept' });
      setSavedConcepts(res.outputs || []);
    } catch (e) {
      console.warn('[ConceptGenerator] Could not load saved concepts:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadSavedConcepts();
  }, []);

  // Handle URL params
  useEffect(() => {
    const title = searchParams.get('title');
    const typology = searchParams.get('typology');
    const location = searchParams.get('location');
    const style = searchParams.get('style');
    const pId = searchParams.get('projectId');
    const savedId = searchParams.get('savedId');

    if (pId) setSelectedProjectId(pId);

    if (title || typology || location || style) {
      setFormData((prev) => ({
        ...prev,
        projectTitle: title || prev.projectTitle,
        projectType: typology || prev.projectType,
        locationClimate: location || prev.locationClimate,
        preferredStyle: style || prev.preferredStyle,
      }));
    }

    if (savedId) {
      loadSpecificSavedConcept(savedId);
    }
  }, [searchParams]);

  // Load specific saved concept from SQLite into workspace
  const loadSpecificSavedConcept = async (outputId: string) => {
    try {
      setIsLoading(true);
      const res = await apiClient.getSavedOutputById(outputId);
      const output = res.output;
      setActiveOutputId(output.id);

      let parsedMeta: any = {};
      try {
        parsedMeta = JSON.parse(output.metadata_json || '{}');
      } catch {}

      // Restore form requirements if available
      if (parsedMeta.inputRequirements) {
        setFormData(parsedMeta.inputRequirements);
      } else if (parsedMeta.inputSummary) {
        setFormData(parsedMeta.inputSummary);
      } else {
        setFormData((prev) => ({ ...prev, projectTitle: output.title }));
      }

      if (output.project_id) {
        setSelectedProjectId(output.project_id);
      }

      // Reconstruct ConceptResult
      const reconstructed: ConceptResult = {
        id: output.id,
        title: output.title,
        timestamp: new Date(output.created_at).toLocaleDateString(),
        tagline: parsedMeta.tagline || 'Climate-Responsive Architectural Synthesis',
        designNarrative: output.content,
        designRationale: parsedMeta.designRationale || '',
        spatialStrategy: parsedMeta.spatialStrategy || [],
        circulationIdeas: parsedMeta.circulationIdeas || [],
        daylightVentilation: parsedMeta.daylightVentilation || [],
        materialPalette: parsedMeta.materialPalette || [],
        facadeSuggestions: parsedMeta.facadeSuggestions || [],
        sustainabilityStrategies: parsedMeta.sustainabilityStrategies || [],
        alternatives: parsedMeta.alternatives || [],
        inputSummary: parsedMeta.inputRequirements || formData,
      };

      setResult(reconstructed);
      setEditableNarrative(output.content);
      setIsSaved(true);
      setIsHistoryOpen(false);
      showToast({ type: 'success', title: 'Concept Loaded', message: `Restored "${output.title}" into workspace.` });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Could Not Load Concept', message: e?.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof ConceptInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectTitle.trim()) {
      showToast({ type: 'error', title: 'Title Required', message: 'Please provide a project title before generating' });
      return;
    }

    setIsLoading(true);
    try {
      const generated = await aiService.generateConcept({
        ...formData,
        projectId: selectedProjectId || undefined,
      });

      setResult(generated);
      setEditableNarrative(generated.designNarrative);
      if (generated.savedOutputId) {
        setActiveOutputId(generated.savedOutputId);
        setIsSaved(true);
      } else {
        setIsSaved(false);
      }

      showToast({
        type: 'success',
        title: 'Architectural Concept Synthesized',
        message: 'Spatial strategies and environmental envelope saved to SQLite archive.',
      });

      loadSavedConcepts();
    } catch (err: any) {
      showToast({ 
        type: 'error', 
        title: 'Generation Error', 
        message: err?.message || 'Could not complete concept synthesis' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConcept = async () => {
    if (!result) return;
    const toSave: ConceptResult = {
      ...result,
      designNarrative: editableNarrative,
    };
    storageService.saveConcept(toSave);

    try {
      if (activeOutputId) {
        await apiClient.updateSavedOutput(activeOutputId, {
          title: toSave.title,
          projectId: selectedProjectId || null,
          content: editableNarrative,
          metadata: toSave,
        });
      } else {
        const res = await apiClient.createSavedOutput({
          projectId: selectedProjectId || undefined,
          type: 'concept',
          title: toSave.title,
          content: editableNarrative,
          metadata: toSave,
        });
        setActiveOutputId(res.output.id);
      }

      setIsSaved(true);
      loadSavedConcepts();
      showToast({
        type: 'success',
        title: 'Saved to Concept Archive',
        message: selectedProjectId ? 'Concept linked to project in SQLite database.' : 'Concept archived in studio database.',
      });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Save Failed', message: e?.message });
    }
  };

  const handleRenameSavedConcept = async (outputId: string) => {
    if (!editingTitle.trim()) return;
    try {
      await apiClient.updateSavedOutput(outputId, { title: editingTitle.trim() });
      setSavedConcepts((prev) =>
        prev.map((c) => (c.id === outputId ? { ...c, title: editingTitle.trim() } : c))
      );
      if (result && activeOutputId === outputId) {
        setResult((prev) => prev ? { ...prev, title: editingTitle.trim() } : null);
      }
      setEditingOutputId(null);
      showToast({ type: 'success', title: 'Concept Renamed', message: 'Title updated in SQLite.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Rename Failed', message: e?.message });
    }
  };

  const handleAssociateProject = async (outputId: string, projectId: string) => {
    try {
      const res = await apiClient.updateSavedOutput(outputId, {
        projectId: projectId || null,
      });
      setSavedConcepts((prev) =>
        prev.map((c) => (c.id === outputId ? res.output : c))
      );
      showToast({
        type: 'success',
        title: 'Project Associated',
        message: projectId ? 'Concept successfully linked to project.' : 'Project link removed.',
      });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Link Failed', message: e?.message });
    }
  };

  const handleDeleteSavedConcept = async () => {
    if (!deletingOutputId) return;
    try {
      await apiClient.deleteSavedOutput(deletingOutputId);
      setSavedConcepts((prev) => prev.filter((c) => c.id !== deletingOutputId));
      if (activeOutputId === deletingOutputId) {
        setResult(null);
        setActiveOutputId(null);
      }
      setDeletingOutputId(null);
      showToast({ type: 'info', title: 'Concept Deleted', message: 'Concept removed from SQLite database.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: e?.message });
    }
  };

  const handleCopyNarrative = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        `# ${result.title}\n\n${editableNarrative}\n\n## Spatial Strategy\n${result.spatialStrategy.join('\n')}`
      );
      showToast({ type: 'success', title: 'Copied to Clipboard', message: 'Concept narrative ready for presentation boards.' });
    } catch {
      showToast({ type: 'error', title: 'Copy Failed', message: 'Clipboard access denied.' });
    }
  };

  const handleClearForm = () => {
    setFormData({
      projectTitle: '',
      projectType: '',
      siteDimensions: '',
      locationClimate: '',
      intendedUsers: '',
      functionalRequirements: '',
      preferredStyle: '',
      materialPreferences: '',
      sustainabilityRequirements: '',
      additionalNotes: ''
    });
    setResult(null);
    setActiveOutputId(null);
    setSearchParams({});
    showToast({ type: 'info', title: 'Workspace Reset', message: 'Form cleared for a new project.' });
  };

  const filteredConcepts = savedConcepts.filter((c) => {
    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase();
    return c.title.toLowerCase().includes(term) || (c.project_title && c.project_title.toLowerCase().includes(term));
  });

  return (
    <div className="relative min-h-screen py-12 lg:py-20 overflow-hidden">
      {/* Background Architectural Illustration */}
      <ArchitectureBackground
        imageSrc="/images/architecture/concepts_feathered.png"
        fallbackSrc="/images/architecture/concepts_hero_bg.jpg"
        alt="Architectural etching of Asian stepped stone temple complex and reflecting pool"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-archBorder/50">
          <div className="max-w-2xl">
            <PageHeading
              kicker={GENZ_VOICE.pageHeaders.concepts.kicker}
              title={GENZ_VOICE.pageHeaders.concepts.title}
              description={GENZ_VOICE.pageHeaders.concepts.subtitle}
            />
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Saved Concepts History Button */}
            <Button
              variant="secondary"
              size="sm"
              icon={<History className="w-4 h-4" />}
              onClick={() => {
                setIsHistoryOpen(true);
                loadSavedConcepts();
              }}
              title="View previously synthesized concepts"
            >
              Saved Concepts {savedConcepts.length > 0 && `(${savedConcepts.length})`}
            </Button>
          </div>
        </div>

        {/* Form and Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Clean Project Input Form */}
          <div className="lg:col-span-5 glass-panel rounded-3xl p-6 sm:p-8 shadow-glass space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-archBorder/40">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-espresso">
                <Sparkles className="w-4 h-4" />
                <span>Project Parameters & Brief</span>
              </div>
              {formData.projectTitle && (
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="text-[11px] text-taupe hover:text-espresso underline"
                >
                  Clear Form
                </button>
              )}
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Optional Project Assignment */}
              {userProjects.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-espresso flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Associate with Project (Optional)</span>
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      const proj = userProjects.find((p) => p.id === e.target.value);
                      if (proj) {
                        setFormData((prev) => ({
                          ...prev,
                          projectTitle: proj.title,
                          projectType: proj.typology || prev.projectType,
                          locationClimate: proj.site_location || prev.locationClimate,
                          preferredStyle: proj.architectural_style || prev.preferredStyle,
                        }));
                      }
                    }}
                    className="w-full bg-cream border border-archBorder rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
                  >
                    <option value="">None (Standalone Concept)</option>
                    {userProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.typology || p.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <FormField label="Project Name & Typology" required>
                <input
                  type="text"
                  value={formData.projectTitle}
                  onChange={(e) => handleChange('projectTitle', e.target.value)}
                  placeholder="e.g. Biophilic Community Arts Center"
                  className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso placeholder:text-taupe"
                  required
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Typology">
                  <input
                    type="text"
                    value={formData.projectType}
                    onChange={(e) => handleChange('projectType', e.target.value)}
                    placeholder="e.g. Cultural / Educational"
                    className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso placeholder:text-taupe"
                  />
                </FormField>
                <FormField label="Site Dimensions">
                  <input
                    type="text"
                    value={formData.siteDimensions}
                    onChange={(e) => handleChange('siteDimensions', e.target.value)}
                    placeholder="e.g. 60m x 45m"
                    className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso placeholder:text-taupe"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Location & Climate">
                  <input
                    type="text"
                    value={formData.locationClimate}
                    onChange={(e) => handleChange('locationClimate', e.target.value)}
                    placeholder="e.g. Ahmedabad, Hot & Dry"
                    className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso placeholder:text-taupe"
                  />
                </FormField>
                <FormField label="Architectural Style">
                  <input
                    type="text"
                    value={formData.preferredStyle}
                    onChange={(e) => handleChange('preferredStyle', e.target.value)}
                    placeholder="e.g. Critical Regionalism"
                    className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso placeholder:text-taupe"
                  />
                </FormField>
              </div>

              <FormField label="Primary Functional Requirements">
                <textarea
                  rows={2}
                  value={formData.functionalRequirements}
                  onChange={(e) => handleChange('functionalRequirements', e.target.value)}
                  placeholder="e.g. Central shaded courtyard, 250-seat amphitheater, flexible galleries..."
                  className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso placeholder:text-taupe resize-none"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Material Preferences">
                  <input
                    type="text"
                    value={formData.materialPreferences}
                    onChange={(e) => handleChange('materialPreferences', e.target.value)}
                    placeholder="e.g. Exposed brick, lime plaster, timber"
                    className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso placeholder:text-taupe"
                  />
                </FormField>
                <FormField label="Sustainability Mandates">
                  <input
                    type="text"
                    value={formData.sustainabilityRequirements}
                    onChange={(e) => handleChange('sustainabilityRequirements', e.target.value)}
                    placeholder="e.g. Passive stack ventilation, rainwater harvesting"
                    className="w-full bg-cream-light border border-archBorder rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso placeholder:text-taupe"
                  />
                </FormField>
              </div>

              <div className="pt-2">
                <PrimaryButton
                  type="submit"
                  size="lg"
                  className="w-full justify-center"
                  disabled={isLoading}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  {isLoading ? 'Synthesizing with Gemini...' : 'Generate Architectural Concept'}
                </PrimaryButton>
              </div>
            </form>
          </div>

          {/* Right Column: Concept Results & Tabs */}
          <div className="lg:col-span-7">
            {isLoading ? (
              <div className="glass-panel rounded-3xl p-12 text-center shadow-glass">
                <LoadingState
                  message={GENZ_VOICE.loadingMessages.concept}
                  subtext="Synthesizing spatial programs, ventilation axes, and structural tectonics..."
                />
              </div>
            ) : result ? (
              <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-glass space-y-6 animate-fadeIn">
                {/* Result Title & Quick Actions */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-archBorder/40">
                  <div>
                    <span className="text-xs uppercase font-mono tracking-wider text-espresso/70">
                      Generated Scheme &bull; {result.timestamp}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-serif font-medium text-ink mt-1">
                      {result.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-espresso italic mt-1 font-serif">
                      "{result.tagline}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
<Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsPdfExportOpen(true)}
                      icon={<FileText className="w-3.5 h-3.5" />}
                      title="Export architectural PDF dossier"
                    >
                      Export PDF
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyNarrative}
                      icon={<Copy className="w-3.5 h-3.5" />}
                      title="Copy complete narrative"
                    >
                      Copy
                    </Button>
                    <Button
                      variant={isSaved ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={handleSaveConcept}
                      icon={<Bookmark className="w-3.5 h-3.5" />}
                    >
                      {isSaved ? 'Saved in Archive' : 'Save Concept'}
                    </Button>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-2 border-b border-archBorder/40 pb-3">
                  {[
                    { id: 'narrative', label: 'Design Narrative' },
                    { id: 'spatial', label: 'Spatial & Circulation' },
                    { id: 'materials', label: 'Material Tectonics' },
                    { id: 'sustainability', label: 'Passive Solar' },
                    { id: 'alternatives', label: 'Design Alternatives' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-espresso text-cream shadow-sm'
                          : 'bg-beige/40 text-ink-muted hover:text-ink hover:bg-beige/70'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab 1: Narrative */}
                {activeTab === 'narrative' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-espresso">
                        Architectural Narrative & Rationale
                      </h4>
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-xs text-espresso hover:underline flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isEditing ? 'Preview Mode' : 'Edit Text'}</span>
                      </button>
                    </div>

                    {isEditing ? (
                      <textarea
                        rows={10}
                        value={editableNarrative}
                        onChange={(e) => setEditableNarrative(e.target.value)}
                        className="w-full bg-cream-light border border-archBorder rounded-2xl p-4 text-xs sm:text-sm text-ink leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-espresso"
                      />
                    ) : (
                      <div className="p-5 rounded-2xl bg-cream/70 border border-archBorder/40">
                        <p className="text-xs sm:text-sm text-ink leading-relaxed whitespace-pre-line font-sans">
                          {editableNarrative}
                        </p>
                      </div>
                    )}

                    {result.designRationale && (
                      <div className="p-4 rounded-xl bg-beige/30 border border-archBorder/50 space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-espresso">
                          Tectonic Rationale
                        </span>
                        <p className="text-xs text-ink-muted leading-relaxed">
                          {result.designRationale}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Spatial Strategy */}
                {activeTab === 'spatial' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-espresso mb-2 flex items-center gap-2">
                      <Maximize2 className="w-4 h-4" />
                      <span>Spatial Zoning & Circulation Hierarchy</span>
                    </h4>

                    <div className="space-y-3">
                      {result.spatialStrategy.map((strat, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-cream border border-archBorder/60 flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-espresso text-cream flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                            {strat}
                          </p>
                        </div>
                      ))}
                    </div>

                    {result.circulationIdeas.length > 0 && (
                      <div className="pt-2">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-espresso mb-2">
                          Circulation Logic & Axis Lines
                        </h5>
                        <ul className="space-y-1.5">
                          {result.circulationIdeas.map((circ, i) => (
                            <li key={i} className="text-xs text-ink-muted flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-espresso mt-1.5 flex-shrink-0" />
                              <span>{circ}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Materials & Tectonics */}
                {activeTab === 'materials' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-espresso mb-2">
                      Material Palette & Fenestration Detail
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {result.materialPalette.map((mat, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-cream border border-archBorder/60 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-ink">{mat.name}</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-beige/50 text-espresso">
                              {mat.role}
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted leading-relaxed">{mat.description}</p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-espresso mb-2">
                        Facade Fenestration & Shading
                      </h5>
                      <ul className="space-y-1.5">
                        {result.facadeSuggestions.map((facade, i) => (
                          <li key={i} className="text-xs text-ink-muted flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-taupe mt-1.5 flex-shrink-0" />
                            <span>{facade}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tab 4: Sustainability */}
                {activeTab === 'sustainability' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-espresso mb-2 flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      <span>Passive Solar & Microclimate Response</span>
                    </h4>

                    <div className="space-y-2">
                      {result.daylightVentilation.map((item, i) => (
                        <div key={i} className="p-3 rounded-xl bg-cream/70 border border-archBorder/40 text-xs text-ink-muted flex items-start gap-2.5">
                          <Trees className="w-4 h-4 text-emerald-800 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-espresso mb-2">
                        Eco-Efficiency Metrics
                      </h5>
                      <ul className="space-y-1.5">
                        {result.sustainabilityStrategies.map((strat, i) => (
                          <li key={i} className="text-xs text-ink-muted flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-800 mt-1.5 flex-shrink-0" />
                            <span>{strat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tab 5: Alternatives */}
                {activeTab === 'alternatives' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-espresso mb-2">
                      Comparative Architectural Variations
                    </h4>
                    <div className="space-y-3">
                      {result.alternatives.map((alt, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-cream border border-archBorder/60 space-y-2">
                          <h5 className="font-serif font-semibold text-espresso text-base">{alt.title}</h5>
                          <p className="text-xs text-ink-muted leading-relaxed">{alt.description}</p>
                          <div className="text-[11px] font-mono text-taupe pt-1 border-t border-archBorder/30">
                            Trade-off: {alt.contrast}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Clean, Uncluttered Initial State */
              <div className="bg-cream/80 backdrop-blur-md border border-archBorder/70 rounded-3xl p-10 sm:p-14 text-center space-y-5 shadow-arch-sm flex flex-col items-center justify-center min-h-[460px]">
                <div className="w-16 h-16 rounded-2xl bg-beige/50 border border-archBorder/60 flex items-center justify-center text-espresso">
                  <Compass className="w-8 h-8 text-espresso/80" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-serif text-2xl font-semibold text-ink">
                    Ready to Cook Up a Concept 🔥
                  </h3>
                  <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
                    Fill in your site parameters on the left and let Archora turn your vague sketch ideas into actual buildable zoning, circulation vectors, and tectonic palettes.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-2 text-xs text-taupe font-mono">
                  <span className="px-3 py-1.5 rounded-full bg-cream border border-archBorder/60 text-ink-muted">
                    Spatial Organization
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-cream border border-archBorder/60 text-ink-muted">
                    Passive Stack Ventilation
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-cream border border-archBorder/60 text-ink-muted">
                    Material Tectonics
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Export Modal */}
      {result && isPdfExportOpen && (
        <PdfExportModal
          isOpen={isPdfExportOpen}
          onClose={() => setIsPdfExportOpen(false)}
          exportType="concept_report"
          targetId={activeOutputId || 'temp_concept'}
          defaultTitle={result.title || formData.projectTitle || 'Design Concept'}
          defaultSubtitle={result.designNarrative?.slice(0, 80)}
        />
      )}

      {/* Saved Concepts Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Saved Design Concepts"
        subtitle="Browse, restore, rename, link to projects, or delete previously generated concepts"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-archBorder/40">
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search saved concepts by title or project..."
              className="flex-1 bg-cream-light border border-archBorder rounded-xl px-3.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-espresso"
            />
            <span className="text-xs font-mono text-espresso">
              {filteredConcepts.length} Saved
            </span>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 text-center text-xs text-ink-muted">Loading concepts...</div>
          ) : filteredConcepts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Compass className="w-8 h-8 text-taupe mx-auto" />
              <p className="text-sm font-serif text-ink">No saved concepts yet</p>
              <p className="text-xs text-ink-muted">
                Concepts synthesized using the form will automatically be archived here.
              </p>
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {filteredConcepts.map((item) => {
                const isEditingThis = editingOutputId === item.id;
                const isCurrent = activeOutputId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-cream border-espresso shadow-arch-sm ring-1 ring-espresso/20'
                        : 'bg-cream/40 border-archBorder/60 hover:bg-cream hover:border-archBorder'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-cream-light border border-espresso text-ink focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSavedConcept(item.id);
                                if (e.key === 'Escape') setEditingOutputId(null);
                              }}
                            />
                            <button
                              onClick={() => handleRenameSavedConcept(item.id)}
                              className="p-1 rounded text-emerald-700 hover:bg-emerald-50"
                              title="Save title"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingOutputId(null)}
                              className="p-1 rounded text-rose-700 hover:bg-rose-50"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => loadSpecificSavedConcept(item.id)}
                            className="cursor-pointer space-y-1"
                          >
                            <div className="flex items-center gap-2">
                              <h5 className="font-serif font-semibold text-base text-ink hover:text-espresso transition-colors">
                                {item.title}
                              </h5>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800">
                                  Viewing
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                              {item.content}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted pt-2 border-t border-archBorder/30 mt-2">
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          
                          {/* Project Assignment dropdown */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-taupe">Project:</span>
                            <select
                              value={item.project_id || ''}
                              onChange={(e) => handleAssociateProject(item.id, e.target.value)}
                              className="bg-cream-light border border-archBorder/60 rounded px-2 py-0.5 text-[11px] text-ink"
                            >
                              <option value="">Unassigned</option>
                              {userProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {!isEditingThis && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingOutputId(item.id);
                              setEditingTitle(item.title);
                            }}
                            className="p-1.5 rounded-lg text-taupe hover:text-espresso hover:bg-beige/40 transition-colors"
                            title="Rename concept"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingOutputId(item.id)}
                            className="p-1.5 rounded-lg text-taupe hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Delete concept"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => loadSpecificSavedConcept(item.id)}
                            className="p-1.5 rounded-lg text-espresso hover:bg-beige/40 transition-colors"
                            title="Open concept"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingOutputId}
        onClose={() => setDeletingOutputId(null)}
        onConfirm={handleDeleteSavedConcept}
        title="Delete Saved Concept"
        message="Are you sure you want to delete this architectural design concept? It will be permanently removed from SQLite."
        confirmLabel="Delete Concept"
        isDestructive
      />
    </div>
  );
};
