import { apiClient } from './apiClient';

export interface VastuDirectionItem {
  id: string;
  name: string;
  deity: string;
  element: string;
  degrees: number;
  sectorAngleStart: number;
  sectorAngleEnd: number;
  color: string;
  qualities: string;
  bioclimatic: string;
  favorableSpaces: string[];
}

export interface VastuKnowledgeRule {
  id: string;
  rule_id: string;
  topic: string;
  direction: string;
  space_type: string;
  recommendation: string;
  explanation: string;
  source_reference: string;
  tradition: string;
  variations?: string;
  confidence_level: string;
  architectural_rationale: string;
}

export interface PlacedRoom {
  id: string;
  name: string;
  spaceType: string;
  direction?: string;
  x?: number; // 0..1
  y?: number; // 0..1
  width?: number;
  height?: number;
  notes?: string;
}

export interface RoomEvaluation {
  roomId: string;
  roomName: string;
  spaceType: string;
  detectedDirection: string;
  directionDegrees: number;
  status: 'Matches selected Vastu guidance' | 'Acceptable traditional alternative' | 'Potential deviation' | 'Needs manual verification' | 'Insufficient information';
  concordance: 'high' | 'acceptable' | 'deviation' | 'review' | 'unknown';
  matchedRuleId: string | null;
  traditionalRecommendation: string;
  explanation: string;
  architecturalRationale: string;
  sourceReference: string;
  tradition: string;
  confidenceLevel: string;
  suggestedDirections: string[];
  remedyOrAlternative: string;
}

export interface VastuEvaluationResult {
  buildingType: string;
  geographicNorthDegrees: number;
  tradition: string;
  totalRooms: number;
  matchesCount: number;
  acceptableCount: number;
  deviationsCount: number;
  reviewCount: number;
  alignmentScore: number;
  overallAssessment: string;
  roomEvaluations: RoomEvaluation[];
  environmentalSummary: string;
  disclaimer: string;
}

export interface VastuAnalysisModel {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  building_type: string;
  geographic_north_degrees: number;
  floor_plan_file_id: string | null;
  floor_plan_image_url: string | null;
  orientation_confirmed: number | boolean;
  rooms: PlacedRoom[];
  results: VastuEvaluationResult;
  summary: string | null;
  tradition: string;
  created_at: string;
  updated_at: string;
}

export const vastuClientService = {
  async getDirections(): Promise<VastuDirectionItem[]> {
    const res = await apiClient.get<{ directions: VastuDirectionItem[] }>('/vastu/directions');
    return res.directions;
  },

  async getRules(params?: { space_type?: string; direction?: string; tradition?: string }): Promise<VastuKnowledgeRule[]> {
    const res = await apiClient.get<{ rules: VastuKnowledgeRule[] }>('/vastu/rules', { params });
    return res.rules;
  },

  async evaluateLayout(payload: {
    rooms: PlacedRoom[];
    geographicNorthDegrees?: number;
    buildingType?: string;
    tradition?: string;
  }): Promise<VastuEvaluationResult> {
    const res = await apiClient.post<{ evaluation: VastuEvaluationResult }>('/vastu/evaluate', payload);
    return res.evaluation;
  },

  async getAiCommentary(payload: {
    evaluation: VastuEvaluationResult;
    userQuery?: string;
  }): Promise<string> {
    const res = await apiClient.post<{ commentary: string }>('/vastu/ai-commentary', payload);
    return res.commentary;
  },

  async listAnalyses(projectId?: string): Promise<VastuAnalysisModel[]> {
    const res = await apiClient.get<{ analyses: VastuAnalysisModel[] }>('/vastu/analyses', {
      params: projectId ? { projectId } : undefined
    });
    return res.analyses;
  },

  async getAnalysis(id: string): Promise<VastuAnalysisModel> {
    const res = await apiClient.get<{ analysis: VastuAnalysisModel }>(`/vastu/analyses/${id}`);
    return res.analysis;
  },

  async saveAnalysis(data: {
    title: string;
    projectId?: string | null;
    buildingType?: string;
    geographicNorthDegrees?: number;
    floorPlanImageUrl?: string | null;
    orientationConfirmed?: boolean;
    rooms: PlacedRoom[];
    results: VastuEvaluationResult;
    summary?: string;
    tradition?: string;
  }): Promise<VastuAnalysisModel> {
    const res = await apiClient.post<{ analysis: VastuAnalysisModel }>('/vastu/analyses', data);
    return res.analysis;
  },

  async updateAnalysis(id: string, data: Partial<{
    title: string;
    projectId: string | null;
    buildingType: string;
    geographicNorthDegrees: number;
    floorPlanImageUrl: string | null;
    orientationConfirmed: boolean;
    rooms: PlacedRoom[];
    results: VastuEvaluationResult;
    summary: string;
    tradition: string;
  }>): Promise<VastuAnalysisModel> {
    const res = await apiClient.put<{ analysis: VastuAnalysisModel }>(`/vastu/analyses/${id}`, data);
    return res.analysis;
  },

  async deleteAnalysis(id: string): Promise<void> {
    await apiClient.delete(`/vastu/analyses/${id}`);
  },

  async exportPdf(analysisId: string, options: any = {}): Promise<Blob> {
    const res = await apiClient.post<{ pdfBase64: string; filename: string }>('/export/pdf', {
      exportType: 'vastu_report',
      targetId: analysisId,
      options
    });
    
    // Decode base64 to Blob
    const binary = atob(res.pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  }
};
