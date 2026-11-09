import React, { useState, useEffect } from 'react';
import {
  Compass,
  LayoutGrid,
  BookOpen,
  FolderKanban,
  Plus,
  Trash2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { VastuCompass } from '@/components/vastu/VastuCompass';
import { VastuFloorPlanAnalyzer } from '@/components/vastu/VastuFloorPlanAnalyzer';
import { VastuResultsView } from '@/components/vastu/VastuResultsView';
import { VastuKnowledgeBrowser } from '@/components/vastu/VastuKnowledgeBrowser';
import {
  VastuDirectionItem,
  VastuEvaluationResult,
  PlacedRoom,
  VastuAnalysisModel,
  vastuClientService,
} from '@/services/vastuService';
import { apiClient, ProjectResponse } from '@/services/apiClient';

export const VastuVision: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'planner' | 'compass' | 'knowledge' | 'saved'>('planner');
  const [directions, setDirections] = useState<VastuDirectionItem[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<string>('North-East');
  const [geographicNorthDegrees, setGeographicNorthDegrees] = useState<number>(0);

  // Active Analysis State
  const [evaluationResult, setEvaluationResult] = useState<VastuEvaluationResult | null>(null);
  const [placedRooms, setPlacedRooms] = useState<PlacedRoom[]>([]);
  const [activeFloorPlanImage, setActiveFloorPlanImage] = useState<string | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<VastuAnalysisModel[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDirections();
    loadSavedAnalyses();
    loadProjects();
  }, []);

  const loadDirections = async () => {
    try {
      const data = await vastuClientService.getDirections();
      setDirections(data);
    } catch (err) {
      console.error('Failed to load directions:', err);
    }
  };

  const loadSavedAnalyses = async () => {
    try {
      const data = await vastuClientService.listAnalyses();
      setSavedAnalyses(data);
    } catch (err) {
      console.error('Failed to load saved analyses:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await apiClient.getProjects();
      setProjects(res.projects);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const handleEvaluationComplete = (
    result: VastuEvaluationResult,
    rooms: PlacedRoom[],
    north: number,
    image: string | null
  ) => {
    setEvaluationResult(result);
    setPlacedRooms(rooms);
    setGeographicNorthDegrees(north);
    setActiveFloorPlanImage(image);
  };

  const handleSaveAnalysis = async (title: string) => {
    if (!evaluationResult) return;
    try {
      const saved = await vastuClientService.saveAnalysis({
        title,
        projectId: selectedProjectId || null,
        buildingType: evaluationResult.buildingType,
        geographicNorthDegrees,
        floorPlanImageUrl: activeFloorPlanImage,
        orientationConfirmed: true,
        rooms: placedRooms,
        results: evaluationResult,
        summary: evaluationResult.overallAssessment,
        tradition: evaluationResult.tradition,
      });

      setCurrentAnalysisId(saved.id);
      loadSavedAnalyses();
      setStatusMessage(`Analysis "${title}" saved successfully to your Studio archive.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage(`Error saving analysis: ${err.message}`);
    }
  };

  const handleExportPdf = async () => {
    if (!evaluationResult) return;
    try {
      // If not yet saved to DB, save temporarily to obtain an ID for PDF rendering
      let analysisId = currentAnalysisId;
      if (!analysisId) {
        const temp = await vastuClientService.saveAnalysis({
          title: 'Vastu Floor Plan Assessment',
          projectId: selectedProjectId || null,
          buildingType: evaluationResult.buildingType,
          geographicNorthDegrees,
          floorPlanImageUrl: activeFloorPlanImage,
          orientationConfirmed: true,
          rooms: placedRooms,
          results: evaluationResult,
          summary: evaluationResult.overallAssessment,
          tradition: evaluationResult.tradition,
        });
        analysisId = temp.id;
        setCurrentAnalysisId(temp.id);
        loadSavedAnalyses();
      }

      const blob = await vastuClientService.exportPdf(analysisId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Archora_Vastu_Assessment_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`PDF Export Failed: ${err.message}`);
    }
  };

  const handleLoadAnalysis = (analysis: VastuAnalysisModel) => {
    setEvaluationResult(analysis.results);
    setPlacedRooms(analysis.rooms || []);
    setGeographicNorthDegrees(analysis.geographic_north_degrees || 0);
    setActiveFloorPlanImage(analysis.floor_plan_image_url || null);
    setCurrentAnalysisId(analysis.id);
    setSelectedProjectId(analysis.project_id || '');
    setActiveTab('planner');
  };

  const handleDeleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved analysis?')) return;
    try {
      await vastuClientService.deleteAnalysis(id);
      if (currentAnalysisId === id) {
        setEvaluationResult(null);
        setCurrentAnalysisId(null);
      }
      loadSavedAnalyses();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const resetCurrentEvaluation = () => {
    setEvaluationResult(null);
    setCurrentAnalysisId(null);
  };

  return (
    <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Hero Header Banner with Glass Effect */}
      <div className="glass-surface-warm rounded-3xl p-6 sm:p-8 border border-archBorder/60 shadow-glass-hover relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 architectural-grid-bg opacity-30 pointer-events-none rounded-bl-full" />
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-stat-card border border-bronze/40">
            <Compass className="w-3.5 h-3.5 text-espresso animate-spin-slow" />
            <span className="text-xs font-serif font-bold text-espresso tracking-wide">
              VastuVision • Traditional Architectural Shastra
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-espresso tracking-tight">
            Indian Vastu Shastra Spatial Planner
          </h1>

          <p className="text-sm sm:text-base text-ink font-sans leading-relaxed">
            Explore authentic classical Indian architectural principles (*Manasara*, *Mayamata*, *Brihat Samhita*) with deterministic directional orientation, bioclimatic rationale, and AI architectural commentary.
          </p>

          {/* Project Linkage Selector */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <span className="text-mutedInk font-medium">Link to Studio Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl glass-input-field"
            >
              <option value="">Independent Study (No Project Link)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 shadow-sm flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold underline ml-4">Dismiss</button>
        </div>
      )}

      {/* 2. Primary Navigation Capsule Tabs */}
      <div className="flex items-center justify-center">
        <div className="p-1.5 rounded-2xl glass-nav-track flex flex-wrap items-center gap-1 shadow-glass max-w-fit">
          <button
            onClick={() => setActiveTab('planner')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'planner'
                ? 'bg-espresso text-cream shadow-md'
                : 'glass-pill-nav text-mutedInk hover:text-espresso'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Floor Plan Analyzer</span>
          </button>

          <button
            onClick={() => setActiveTab('compass')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'compass'
                ? 'bg-espresso text-cream shadow-md'
                : 'glass-pill-nav text-mutedInk hover:text-espresso'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Interactive Compass</span>
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'knowledge'
                ? 'bg-espresso text-cream shadow-md'
                : 'glass-pill-nav text-mutedInk hover:text-espresso'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge Canons</span>
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'saved'
                ? 'bg-espresso text-cream shadow-md'
                : 'glass-pill-nav text-mutedInk hover:text-espresso'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Saved Analyses ({savedAnalyses.length})</span>
          </button>
        </div>
      </div>

      {/* 3. Main Dynamic Workspace Body */}
      {activeTab === 'planner' && (
        <div className="space-y-6">
          {evaluationResult ? (
            <VastuResultsView
              evaluation={evaluationResult}
              rooms={placedRooms}
              northDegrees={geographicNorthDegrees}
              imageUrl={activeFloorPlanImage}
              onReset={resetCurrentEvaluation}
              onSaveToProject={handleSaveAnalysis}
              onExportPdf={handleExportPdf}
              savedAnalysisId={currentAnalysisId || undefined}
            />
          ) : (
            <VastuFloorPlanAnalyzer
              onEvaluationComplete={handleEvaluationComplete}
              initialRooms={placedRooms}
              initialNorthDegrees={geographicNorthDegrees}
              initialImageUrl={activeFloorPlanImage}
            />
          )}
        </div>
      )}

      {activeTab === 'compass' && (
        <div className="glass-surface-warm rounded-3xl p-6 sm:p-8 border border-archBorder/60 shadow-glass">
          <VastuCompass
            directions={directions}
            selectedDirection={selectedDirection}
            onSelectDirection={setSelectedDirection}
            geographicNorthDegrees={geographicNorthDegrees}
            onNorthDegreesChange={setGeographicNorthDegrees}
            interactive={true}
          />
        </div>
      )}

      {activeTab === 'knowledge' && <VastuKnowledgeBrowser />}

      {activeTab === 'saved' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif font-bold text-espresso">Studio Vastu Assessments</h3>
            <button
              onClick={() => {
                resetCurrentEvaluation();
                setActiveTab('planner');
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-espresso text-cream hover:bg-espresso/90 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Analysis</span>
            </button>
          </div>

          {savedAnalyses.length === 0 ? (
            <div className="glass-surface-warm rounded-2xl p-12 text-center border border-archBorder/60 space-y-3">
              <FolderKanban className="w-8 h-8 text-espresso/40 mx-auto" />
              <h4 className="text-sm font-serif font-bold text-espresso">No Saved Analyses</h4>
              <p className="text-xs text-mutedInk max-w-sm mx-auto">
                Evaluate a floor plan in the Analyzer tab and click &quot;Save to Project Library&quot; to archive it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedAnalyses.map((analysis) => {
                const results = analysis.results || {};
                return (
                  <div
                    key={analysis.id}
                    onClick={() => handleLoadAnalysis(analysis)}
                    className="glass-panel-elevated rounded-2xl p-5 border border-archBorder/60 shadow-glass cursor-pointer hover:border-espresso transition-all card-3d-tilt flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cream border border-archBorder/50 text-espresso font-bold">
                          {analysis.building_type}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {results.alignmentScore ?? 85}% Alignment
                        </span>
                      </div>

                      <h4 className="text-base font-serif font-bold text-espresso leading-snug">
                        {analysis.title}
                      </h4>

                      <p className="text-xs text-mutedInk mt-1 line-clamp-2">
                        {analysis.summary || results.overallAssessment || 'Spatial layout assessment.'}
                      </p>

                      <div className="text-[11px] font-mono text-faintInk mt-3">
                        Canon: {analysis.tradition} • North: {analysis.geographic_north_degrees}°
                      </div>
                    </div>

                    <div className="pt-3 border-t border-archBorder/30 flex items-center justify-between text-xs">
                      <span className="text-mutedInk">
                        {new Date(analysis.created_at).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDeleteAnalysis(analysis.id, e)}
                          className="p-1 text-mutedInk hover:text-red-700 transition"
                          title="Delete Analysis"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-espresso font-semibold flex items-center gap-0.5 hover:underline">
                          Open <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Bottom Ethical Responsibility Disclaimer */}
      <div className="p-4 rounded-2xl glass-surface-warm border border-archBorder/50 text-xs text-mutedInk flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-espresso flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-espresso font-semibold">Architectural & Cultural Notice:</strong>
          <p className="leading-relaxed text-[11px]">
            Archora VastuVision is an architectural education and design exploration tool. It does not promise superstitious outcomes or supernatural guarantees. Municipal building codes, fire and egress regulations, seismic/structural engineering, ventilation, and universal accessibility supersede traditional spatial placements.
          </p>
        </div>
      </div>
    </div>
  );
};
