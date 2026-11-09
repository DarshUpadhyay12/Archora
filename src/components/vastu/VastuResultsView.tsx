import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  Download,
  FolderKanban,
  RotateCcw,
  BookOpen,
  Send,
  Loader2,
  Sun,
  ShieldCheck,
} from 'lucide-react';
import { VastuEvaluationResult, PlacedRoom, vastuClientService } from '@/services/vastuService';

interface VastuResultsViewProps {
  evaluation: VastuEvaluationResult;
  rooms: PlacedRoom[];
  northDegrees: number;
  imageUrl: string | null;
  onReset: () => void;
  onSaveToProject?: (title: string, projectId?: string) => Promise<void>;
  onExportPdf?: () => void;
  savedAnalysisId?: string;
}

export const VastuResultsView: React.FC<VastuResultsViewProps> = ({
  evaluation,
  rooms,
  northDegrees,
  imageUrl,
  onReset,
  onSaveToProject,
  onExportPdf,
  savedAnalysisId,
}) => {
  const [aiCommentary, setAiCommentary] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState<string>('Vastu Spatial Assessment');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Request AI commentary from Gemini
  const handleRequestAiCommentary = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const commentary = await vastuClientService.getAiCommentary({
        evaluation,
        userQuery: userQuery.trim() || undefined,
      });
      setAiCommentary(commentary);
      setUserQuery('');
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate AI architectural commentary.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleSave = async () => {
    if (!onSaveToProject) return;
    setIsSaving(true);
    try {
      await onSaveToProject(saveTitle);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. Header Banner & Concordance Score */}
      <div className="glass-surface-warm rounded-2xl p-6 border border-archBorder/60 shadow-glass flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-serif font-bold text-espresso">Spatial Analysis Synthesis</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cream border border-archBorder/60 text-espresso">
              {evaluation.tradition} Canon
            </span>
          </div>
          <p className="text-xs text-mutedInk mt-1">
            Geographic North calibrated at {northDegrees}° • {rooms.length || evaluation.totalRooms} rooms evaluated
            {savedAnalysisId && ` • ID: ${savedAnalysisId}`}
          </p>
          <p className="text-xs text-ink font-medium mt-2 leading-relaxed max-w-2xl">
            {evaluation.overallAssessment}
          </p>
          {imageUrl && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] font-mono text-faintInk">Attached Plan Reference:</span>
              <img src={imageUrl} alt="Evaluated Floor Plan" className="w-12 h-12 object-cover rounded-lg border border-archBorder/60" />
            </div>
          )}
        </div>

        {/* Concordance Score Ring / Metric */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl glass-stat-card border border-bronze/40 p-2 shadow-sm">
            <span className="text-2xl font-serif font-bold text-espresso">{evaluation.alignmentScore}%</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-mutedInk text-center leading-tight">
              Alignment Index
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {onExportPdf && (
              <button
                onClick={onExportPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-espresso text-cream hover:bg-espresso/90 transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            )}

            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium glass-stat-card text-espresso hover:bg-cream transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Adjust Layout</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Concordance Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl glass-stat-card border-l-4 border-l-emerald-600">
          <span className="text-[10px] uppercase font-bold text-mutedInk tracking-wider block">Matches Guidance</span>
          <span className="text-xl font-serif font-bold text-emerald-800">{evaluation.matchesCount}</span>
        </div>

        <div className="p-3.5 rounded-xl glass-stat-card border-l-4 border-l-sky-600">
          <span className="text-[10px] uppercase font-bold text-mutedInk tracking-wider block">Acceptable Alt.</span>
          <span className="text-xl font-serif font-bold text-sky-800">{evaluation.acceptableCount}</span>
        </div>

        <div className="p-3.5 rounded-xl glass-stat-card border-l-4 border-l-amber-600">
          <span className="text-[10px] uppercase font-bold text-mutedInk tracking-wider block">Potential Deviations</span>
          <span className="text-xl font-serif font-bold text-amber-800">{evaluation.deviationsCount}</span>
        </div>

        <div className="p-3.5 rounded-xl glass-stat-card border-l-4 border-l-stone-500">
          <span className="text-[10px] uppercase font-bold text-mutedInk tracking-wider block">Needs Verification</span>
          <span className="text-xl font-serif font-bold text-stone-700">{evaluation.reviewCount}</span>
        </div>
      </div>

      {/* 3. Detailed Room-by-Room Evaluation List */}
      <div className="glass-surface-warm rounded-2xl p-5 border border-archBorder/60 shadow-glass space-y-4">
        <h4 className="text-base font-serif font-bold text-espresso flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-espresso" />
          Room-by-Room Directional Findings
        </h4>

        <div className="space-y-3">
          {evaluation.roomEvaluations.map((room, idx) => {
            const isMatch = room.status === 'Matches selected Vastu guidance';
            const isAcceptable = room.status === 'Acceptable traditional alternative';
            const isDeviation = room.status === 'Potential deviation';

            const badgeBg = isMatch
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : isAcceptable
              ? 'bg-sky-50 text-sky-800 border-sky-300'
              : isDeviation
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-stone-50 text-stone-800 border-stone-300';

            const Icon = isMatch || isAcceptable ? CheckCircle2 : isDeviation ? AlertTriangle : Info;

            return (
              <div
                key={room.roomId || idx}
                className="p-4 rounded-xl glass-panel border border-archBorder/50 space-y-2 transition-all hover:bg-cream/90"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-serif font-bold text-espresso">
                      {idx + 1}. {room.roomName}
                    </span>
                    <span className="text-xs text-mutedInk">({room.spaceType})</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-cream border border-archBorder/40 text-espresso">
                      {room.detectedDirection} ({room.directionDegrees}°)
                    </span>
                  </div>

                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeBg}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{room.status}</span>
                  </span>
                </div>

                {/* Recommendation & Classical Explanation */}
                <p className="text-xs text-ink leading-relaxed">
                  <strong className="text-espresso font-semibold">Classical Guidance: </strong>
                  {room.traditionalRecommendation}
                </p>

                {/* Architectural & Bioclimatic Rationale */}
                <div className="p-2.5 rounded-lg bg-cream/70 border border-archBorder/40 text-xs text-espresso/90 flex items-start gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-espresso">Architectural Rationale: </span>
                    {room.architecturalRationale}
                  </div>
                </div>

                {/* Alternatives & Source Citation */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-mutedInk">
                  <span>
                    <strong>Remedy / Alternative: </strong> {room.remedyOrAlternative}
                  </span>
                  {room.sourceReference && (
                    <span className="italic font-serif">
                      Source: {room.sourceReference}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Gemini AI Architectural Synthesis & Q&A */}
      <div className="glass-surface-warm rounded-2xl p-5 border border-archBorder/60 shadow-glass space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h4 className="text-base font-serif font-bold text-espresso">AI Architectural Synthesis</h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Zero-Cost Policy Active
            </span>
          </div>

          {!aiCommentary && (
            <button
              onClick={handleRequestAiCommentary}
              disabled={isLoadingAi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-espresso text-cream hover:bg-espresso/90 disabled:opacity-50 transition shadow-xs"
            >
              {isLoadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
              <span>{isLoadingAi ? 'Consulting Gemini...' : 'Synthesize with AI'}</span>
            </button>
          )}
        </div>

        {aiError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {aiError}
          </div>
        )}

        {aiCommentary && (
          <div className="p-4 rounded-xl glass-panel border border-archBorder/50 space-y-3">
            <div className="prose prose-sm text-xs text-ink max-w-none whitespace-pre-wrap leading-relaxed font-sans">
              {aiCommentary}
            </div>

            {/* Follow-up question input */}
            <div className="pt-2 border-t border-archBorder/30 flex gap-2">
              <input
                type="text"
                placeholder="Ask follow-up question (e.g. How to optimize kitchen ventilation in South-East?)..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRequestAiCommentary()}
                className="flex-1 text-xs px-3 py-2 rounded-xl glass-input-field"
              />
              <button
                onClick={handleRequestAiCommentary}
                disabled={isLoadingAi || !userQuery.trim()}
                className="p-2 rounded-xl bg-espresso text-cream hover:bg-espresso/90 disabled:opacity-50 transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Save to Project Library Section */}
      {onSaveToProject && (
        <div className="glass-surface-warm rounded-2xl p-4 border border-archBorder/60 shadow-glass flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-espresso" />
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="Analysis Title..."
              className="text-xs px-3 py-1.5 rounded-lg glass-input-field w-64"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-espresso text-cream hover:bg-espresso/90 disabled:opacity-50 transition shadow-xs"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderKanban className="w-3.5 h-3.5 text-amber-300" />}
            <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved to Studio!' : 'Save to Project Library'}</span>
          </button>
        </div>
      )}

      {/* 6. Ethical Responsibility & Building Code Notice */}
      <div className="p-4 rounded-xl bg-cream/70 border border-archBorder/60 text-xs text-mutedInk flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-espresso flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-espresso font-semibold">Architectural & Cultural Responsibility Notice:</strong>
          <p className="leading-relaxed text-[11px]">
            {evaluation.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
};
