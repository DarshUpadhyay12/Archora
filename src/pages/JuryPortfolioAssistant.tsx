import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Copy, 
  Bookmark, 
  Printer, 
  Award,
  History,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronRight,
  FolderKanban,
  FileText
} from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { FormField } from '@/components/common/FormField';
import { LoadingState } from '@/components/common/LoadingAndEmpty';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { PdfExportModal } from '@/components/common/PdfExportModal';
import { showToast } from '@/components/common/Toast';
import { aiService } from '@/services/aiService';
import { apiClient, SavedOutputResponse, ProjectResponse } from '@/services/apiClient';
import { ContentType, VivaQuestion } from '@/types';
import { GENZ_VOICE } from '@/config/genzVoice';

export const JuryPortfolioAssistant: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>('jury-viva-questions');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('projectId') || '');
  const [customTitle, setCustomTitle] = useState(searchParams.get('title') || '');
  const [keyDetails, setKeyDetails] = useState(searchParams.get('details') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [contentTitle, setContentTitle] = useState('Anticipated Jury Viva Questions');
  const [editorText, setEditorText] = useState('');
  const [vivaQuestions, setVivaQuestions] = useState<VivaQuestion[]>([]);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // History state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [savedOutputs, setSavedOutputs] = useState<SavedOutputResponse[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [editingOutputId, setEditingOutputId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingOutputId, setDeletingOutputId] = useState<string | null>(null);

  const contentTypes: { id: ContentType; label: string }[] = [
    { id: 'jury-viva-questions', label: 'Jury & Viva Questions 💀' },
    { id: 'concept-statement', label: '100-Word Concept Statement' },
    { id: 'abstract', label: 'Project Abstract' },
    { id: 'presentation-outline', label: '10-Min Presentation Arc (Don\'t Ramble)' },
    { id: 'project-description', label: 'Portfolio Board Narrative' },
  ];

  // Load user projects
  useEffect(() => {
    apiClient.getProjects().then((res) => {
      setProjects(res.projects || []);
    }).catch((e) => console.warn('[JuryAssistant] Could not load projects:', e));
  }, []);

  // Load saved jury/portfolio outputs
  const loadSavedOutputs = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await apiClient.getSavedOutputs();
      // Filter to jury and portfolio types
      const juryTypes = ['jury-viva-questions', 'concept-statement', 'abstract', 'presentation-outline', 'project-description', 'portfolio-narrative', 'design-rationale'];
      const filtered = (res.outputs || []).filter((o) => juryTypes.includes(o.type));
      setSavedOutputs(filtered);
    } catch (e) {
      console.warn('[JuryAssistant] Could not load saved outputs:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadSavedOutputs();
  }, []);

  // Handle URL params
  useEffect(() => {
    const pId = searchParams.get('projectId');
    const pTitle = searchParams.get('title');
    const pDetails = searchParams.get('details');
    const savedId = searchParams.get('savedId');

    if (pId) setSelectedProjectId(pId);
    if (pTitle) setCustomTitle(pTitle);
    if (pDetails) setKeyDetails(pDetails);

    if (savedId) {
      loadSpecificSavedOutput(savedId);
    }
  }, [searchParams]);

  // Load saved output from SQLite
  const loadSpecificSavedOutput = async (outputId: string) => {
    try {
      setIsLoading(true);
      const res = await apiClient.getSavedOutputById(outputId);
      const output = res.output;
      setActiveOutputId(output.id);
      setContentTitle(output.title);
      setEditorText(output.content);

      if (output.project_id) {
        setSelectedProjectId(output.project_id);
      }

      // Check if this is a known content type
      const matchedType = contentTypes.find((t) => t.id === output.type);
      if (matchedType) {
        setSelectedContentType(matchedType.id);
      }

      let parsedMeta: any = {};
      try { parsedMeta = JSON.parse(output.metadata_json || '{}'); } catch {}

      if (parsedMeta.questions && Array.isArray(parsedMeta.questions)) {
        setVivaQuestions(parsedMeta.questions);
      } else {
        setVivaQuestions([]);
      }

      if (parsedMeta.projectTitle) setCustomTitle(parsedMeta.projectTitle);
      if (parsedMeta.keyDetails) setKeyDetails(parsedMeta.keyDetails);

      setHasGenerated(true);
      setIsSaved(true);
      setIsHistoryOpen(false);
      showToast({ type: 'success', title: 'Asset Loaded', message: `Restored "${output.title}" into studio workspace.` });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Load Failed', message: e?.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    if (!projId) {
      setCustomTitle('');
      setKeyDetails('');
      return;
    }
    const proj = projects.find((p) => p.id === projId);
    if (proj) {
      setCustomTitle(proj.title);
      setKeyDetails(proj.description);
    }
  };

  const handleGenerate = async () => {
    if (!customTitle.trim()) {
      showToast({ type: 'error', title: 'Title Required', message: 'Please select a project or enter a project title.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await aiService.generatePortfolioAsset(
        selectedContentType,
        customTitle,
        keyDetails,
        selectedProjectId || undefined
      );

      setContentTitle(res.title);
      setEditorText(res.content);
      if (res.questions) {
        setVivaQuestions(res.questions);
      } else {
        setVivaQuestions([]);
      }

      if (res.savedOutputId) {
        setActiveOutputId(res.savedOutputId);
        setIsSaved(true);
      } else {
        setIsSaved(false);
      }

      setHasGenerated(true);
      showToast({
        type: 'success',
        title: 'Jury Asset Generated',
        message: 'Content tailored for your studio defense and saved to SQLite archive.',
      });

      loadSavedOutputs();
    } catch (err: any) {
      showToast({ 
        type: 'error', 
        title: 'Generation Error', 
        message: err?.message || 'Could not generate jury asset' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      const textToCopy = selectedContentType === 'jury-viva-questions'
        ? vivaQuestions.map((q, i) => `Q${i+1}: ${q.question}\nIntent: ${q.intent}\nPoints: ${q.keyPointsToAddress.join(', ')}\nGuide: ${q.suggestedAnswerGuide}`).join('\n\n')
        : editorText;
      await navigator.clipboard.writeText(textToCopy);
      showToast({ type: 'success', title: 'Copied to Clipboard', message: 'Ready to paste into sheets or slides.' });
    } catch {
      showToast({ type: 'error', title: 'Copy Failed', message: 'Could not access clipboard' });
    }
  };

  const handleSave = async () => {
    try {
      if (activeOutputId) {
        await apiClient.updateSavedOutput(activeOutputId, {
          title: contentTitle,
          projectId: selectedProjectId || null,
          content: editorText || 'Jury Viva Questions & Defense',
          metadata: {
            questions: vivaQuestions,
            contentType: selectedContentType,
            projectTitle: customTitle,
            keyDetails,
          },
        });
      } else {
        const res = await apiClient.createSavedOutput({
          projectId: selectedProjectId || undefined,
          type: selectedContentType,
          title: contentTitle,
          content: editorText || 'Jury Viva Questions & Defense',
          metadata: {
            questions: vivaQuestions,
            contentType: selectedContentType,
            projectTitle: customTitle,
            keyDetails,
          },
        });
        setActiveOutputId(res.output.id);
      }

      setIsSaved(true);
      loadSavedOutputs();
      showToast({
        type: 'success',
        title: 'Saved to SQLite Archive',
        message: selectedProjectId ? 'Asset linked to project in SQLite database.' : 'Draft archived in your studio database.',
      });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Save Failed', message: e?.message });
    }
  };

  const handleRenameSavedOutput = async (outputId: string) => {
    if (!editingTitle.trim()) return;
    try {
      await apiClient.updateSavedOutput(outputId, { title: editingTitle.trim() });
      setSavedOutputs((prev) =>
        prev.map((o) => (o.id === outputId ? { ...o, title: editingTitle.trim() } : o))
      );
      if (activeOutputId === outputId) {
        setContentTitle(editingTitle.trim());
      }
      setEditingOutputId(null);
      showToast({ type: 'success', title: 'Asset Renamed', message: 'Title updated in SQLite.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Rename Failed', message: e?.message });
    }
  };

  const handleAssociateProject = async (outputId: string, projectId: string) => {
    try {
      const res = await apiClient.updateSavedOutput(outputId, {
        projectId: projectId || null,
      });
      setSavedOutputs((prev) =>
        prev.map((o) => (o.id === outputId ? res.output : o))
      );
      showToast({
        type: 'success',
        title: 'Project Associated',
        message: projectId ? 'Asset linked to project.' : 'Project link removed.',
      });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Link Failed', message: e?.message });
    }
  };

  const handleDeleteSavedOutput = async () => {
    if (!deletingOutputId) return;
    try {
      await apiClient.deleteSavedOutput(deletingOutputId);
      setSavedOutputs((prev) => prev.filter((o) => o.id !== deletingOutputId));
      if (activeOutputId === deletingOutputId) {
        setHasGenerated(false);
        setActiveOutputId(null);
        setEditorText('');
        setVivaQuestions([]);
      }
      setDeletingOutputId(null);
      showToast({ type: 'info', title: 'Asset Deleted', message: 'Asset removed from SQLite database.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: e?.message });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredOutputs = savedOutputs.filter((o) => {
    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase();
    return o.title.toLowerCase().includes(term) || (o.project_title && o.project_title.toLowerCase().includes(term));
  });

  return (
    <div className="relative min-h-screen py-12 lg:py-20 overflow-hidden">
      {/* Background Architectural Illustration */}
      <ArchitectureBackground
        imageSrc="/images/architecture/portfolio_feathered.png"
        fallbackSrc="/images/architecture/portfolio_hero_bg.jpg"
        alt="Architectural pen and ink etching of classical European palace colonnade"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Page Heading Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-archBorder/50">
          <div className="max-w-2xl">
            <PageHeading
              kicker={GENZ_VOICE.pageHeaders.jury.kicker}
              title={GENZ_VOICE.pageHeaders.jury.title}
              description={GENZ_VOICE.pageHeaders.jury.subtitle}
            />
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* History Toggle Button */}
            <Button
              variant="secondary"
              size="sm"
              icon={<History className="w-4 h-4" />}
              onClick={() => {
                setIsHistoryOpen(true);
                loadSavedOutputs();
              }}
              title="View previously generated jury and portfolio outputs"
            >
              Saved Archive {savedOutputs.length > 0 && `(${savedOutputs.length})`}
            </Button>
          </div>
        </div>

        {/* 3 Juror Archetype Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {GENZ_VOICE.juryCritiques.map((critique, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl glass-panel border border-archBorder/50 shadow-2xs space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-espresso">
                <span>{critique.name}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-parchment/80 border border-archBorder/40 text-taupe">
                  {critique.role}
                </span>
              </div>
              <p className="text-xs font-serif font-semibold text-ink italic">
                "{critique.vibe}"
              </p>
              <p className="text-[11px] text-ink-muted leading-tight">
                {critique.description}
              </p>
            </div>
          ))}
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Clean Content Type & Project Configuration */}
          <div className="lg:col-span-5 glass-panel shadow-glass rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-archBorder/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-espresso">
                Configuration & Parameters
              </span>
              <span className="text-[11px] font-mono text-taupe">AI Studio Tool</span>
            </div>

            {/* Content Type Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-espresso">
                Deliverable Format
              </label>
              <div className="space-y-1.5">
                {contentTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedContentType(type.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between border cursor-pointer ${
                      selectedContentType === type.id
                        ? 'bg-espresso text-cream border-espresso shadow-arch-sm font-semibold'
                        : 'glass-card text-ink-muted hover:text-ink hover:bg-cream/90 border-archBorder/40'
                    }`}
                  >
                    <span>{type.label}</span>
                    {selectedContentType === type.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cream" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Project Selector */}
            {projects.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-espresso flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>Select Studio Project</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full bg-cream border border-archBorder rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
                >
                  <option value="">Manual Entry (No Project Selected)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.typology || p.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Project Title & Scope */}
            <FormField label="Project Title" required>
              <input
                type="text"
                value={customTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTitle(e.target.value)}
                placeholder="e.g. Adaptive Reuse of Thanjavur Grain Mill"
                className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder focus:border-espresso focus:ring-1 focus:ring-espresso text-sm text-ink outline-none transition-all"
              />
            </FormField>

            <FormField label="Key Focus, Climate Rationale & Constraints">
              <textarea
                value={keyDetails}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setKeyDetails(e.target.value)}
                rows={4}
                placeholder="e.g. Heavy timber structure, seasonal flood risk, passive stack ventilation, community weaving workshops..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder focus:border-espresso focus:ring-1 focus:ring-espresso text-sm text-ink outline-none transition-all resize-none"
              />
            </FormField>

            <PrimaryButton
              size="lg"
              className="w-full justify-center"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? 'Synthesizing with Gemini...' : 'Synthesize Defense & Copy'}
            </PrimaryButton>
          </div>

          {/* Right Column: Generated Output, Viva Q&As, or Clean Workspace */}
          <div className="lg:col-span-7 glass-panel shadow-glass rounded-3xl p-6 sm:p-8 min-h-[500px]">
            {isLoading ? (
              <div className="py-20 text-center">
                <LoadingState
                  message={GENZ_VOICE.loadingMessages.jury}
                  subtext="Simulating 3 harsh professors sharpening their red pens... roast-proofing in progress."
                />
              </div>
            ) : hasGenerated ? (
              <div className="space-y-6 animate-fadeIn">
                {/* Output Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-archBorder/40">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-espresso/70">
                      Studio Output &bull; {contentTypes.find((t) => t.id === selectedContentType)?.label}
                    </span>
                    <h4 className="font-serif font-semibold text-2xl text-ink mt-0.5">
                      {contentTitle}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopy}
                      icon={<Copy className="w-3.5 h-3.5" />}
                      title="Copy to clipboard"
                    >
                      Copy
                    </Button>
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
                      onClick={handlePrint}
                      icon={<Printer className="w-3.5 h-3.5" />}
                      title="Print or export to presentation boards"
                    >
                      Print
                    </Button>
                    <Button
                      variant={isSaved ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={handleSave}
                      icon={<Bookmark className="w-3.5 h-3.5" />}
                    >
                      {isSaved ? 'Saved in Archive' : 'Save Output'}
                    </Button>
                  </div>
                </div>

                {/* Specific Jury Viva Cards */}
                {selectedContentType === 'jury-viva-questions' && vivaQuestions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl glass-card border border-archBorder/50 text-xs text-ink-muted">
                      💡 <strong>Studio Viva Strategy:</strong> Jurors typically test tectonic justification, climate response, and user circulation. Use the talking points below to defend your design logically.
                    </div>

                    <div className="space-y-3.5">
                      {vivaQuestions.map((q, i) => (
                        <div key={i} className="p-5 rounded-2xl glass-card border border-archBorder/50 space-y-3">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-espresso text-cream flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5 shadow-sm">
                              {i + 1}
                            </span>
                            <div className="space-y-1">
                              <h5 className="font-serif font-semibold text-espresso text-base">
                                {q.question}
                              </h5>
                              <p className="text-xs text-ink-muted italic">
                                Examiner's Intent: {q.intent}
                              </p>
                            </div>
                          </div>

                          <div className="pl-9 space-y-2">
                            <div>
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-espresso block mb-1">
                                Essential Talking Points:
                              </span>
                              <ul className="space-y-1">
                                {q.keyPointsToAddress.map((point, pIdx) => (
                                  <li key={pIdx} className="text-xs text-ink-muted flex items-start gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-taupe mt-1.5 flex-shrink-0" />
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-3.5 rounded-xl bg-parchment/40 border border-archBorder/40">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-espresso block mb-0.5">
                                Recommended Defense Argument:
                              </span>
                              <p className="text-xs text-ink-muted leading-relaxed">
                                {q.suggestedAnswerGuide}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Formatted Narrative / Presentation Script */
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-espresso">
                      Editable Text & Narrative
                    </label>
                    <textarea
                      rows={14}
                      value={editorText}
                      onChange={(e) => setEditorText(e.target.value)}
                      className="w-full bg-cream border border-archBorder rounded-2xl p-4 text-xs sm:text-sm text-ink leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-espresso resize-y"
                      placeholder="Your presentation script..."
                    />
                    <div className="flex items-center justify-between text-[11px] text-taupe px-1 font-mono">
                      <span>Words: {editorText.trim() ? editorText.trim().split(/\s+/).length : 0}</span>
                      <span>Formatted for Portfolio Sheets</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Clean Initial State */
              <div className="py-16 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-espresso mx-auto shadow-sm">
                  <Award className="w-7 h-7 text-espresso/80" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-serif text-2xl font-semibold text-ink">
                    Prepare for Academic Interrogation 💀
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
                    Select an asset type and enter your project parameters on the left. Click <strong>Synthesize Defense & Copy</strong> to generate roast-proof answers, 10-minute presentation arcs, and bulletproof abstracts.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-2 text-xs text-taupe font-mono">
                  <span className="px-3.5 py-1 rounded-full glass-card border border-archBorder/40">Jury Viva Q&A</span>
                  <span className="px-3.5 py-1 rounded-full glass-card border border-archBorder/40">10-Min Story Arc</span>
                  <span className="px-3.5 py-1 rounded-full glass-card border border-archBorder/40">Concept Statements</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Outputs Archive Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Saved Jury & Portfolio Archive"
        subtitle="Browse, reopen, rename, associate with projects, or delete saved defense assets"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-archBorder/40">
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search saved outputs by title or project..."
              className="flex-1 bg-cream-light border border-archBorder rounded-xl px-3.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-espresso"
            />
            <span className="text-xs font-mono text-espresso">
              {filteredOutputs.length} Saved
            </span>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 text-center text-xs text-ink-muted">Loading archive...</div>
          ) : filteredOutputs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="w-8 h-8 text-taupe mx-auto" />
              <p className="text-sm font-serif text-ink">No saved jury assets yet</p>
              <p className="text-xs text-ink-muted">
                Synthesized viva questions and portfolio drafts will appear here.
              </p>
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {filteredOutputs.map((item) => {
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
                                if (e.key === 'Enter') handleRenameSavedOutput(item.id);
                                if (e.key === 'Escape') setEditingOutputId(null);
                              }}
                            />
                            <button
                              onClick={() => handleRenameSavedOutput(item.id)}
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
                            onClick={() => loadSpecificSavedOutput(item.id)}
                            className="cursor-pointer space-y-1"
                          >
                            <div className="flex items-center gap-2">
                              <h5 className="font-serif font-semibold text-base text-ink hover:text-espresso transition-colors">
                                {item.title}
                              </h5>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-beige/60 text-espresso capitalize">
                                {item.type.replace(/-/g, ' ')}
                              </span>
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
                          
                          {/* Project Assignment */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-taupe">Project:</span>
                            <select
                              value={item.project_id || ''}
                              onChange={(e) => handleAssociateProject(item.id, e.target.value)}
                              className="bg-cream-light border border-archBorder/60 rounded px-2 py-0.5 text-[11px] text-ink"
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
                      </div>

                      {!isEditingThis && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingOutputId(item.id);
                              setEditingTitle(item.title);
                            }}
                            className="p-1.5 rounded-lg text-taupe hover:text-espresso hover:bg-beige/40 transition-colors"
                            title="Rename output"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingOutputId(item.id)}
                            className="p-1.5 rounded-lg text-taupe hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Delete output"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => loadSpecificSavedOutput(item.id)}
                            className="p-1.5 rounded-lg text-espresso hover:bg-beige/40 transition-colors"
                            title="Open output"
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

      {/* PDF Export Modal */}
      {hasGenerated && isPdfExportOpen && (
        <PdfExportModal
          isOpen={isPdfExportOpen}
          onClose={() => setIsPdfExportOpen(false)}
          exportType={selectedContentType === 'project-description' || selectedContentType === 'presentation-outline' ? 'portfolio' : 'jury_prep'}
          targetId={activeOutputId || 'active_jury'}
          defaultTitle={contentTitle || customTitle || 'Jury Defense Dossier'}
          defaultSubtitle={selectedProjectId ? 'Project Linked Defense' : 'Studio Examination Strategy'}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingOutputId}
        onClose={() => setDeletingOutputId(null)}
        onConfirm={handleDeleteSavedOutput}
        title="Delete Saved Asset"
        message="Are you sure you want to delete this presentation asset? It will be permanently removed from SQLite."
        confirmLabel="Delete Asset"
        isDestructive
      />
    </div>
  );
};
