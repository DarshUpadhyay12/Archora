export interface TutorRequest {
  question: string;
  topic?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface TokenUsageMetrics {
  promptTokens: number | null;
  candidatesTokens: number | null;
  totalTokens: number | null;
}

export interface TutorResponse {
  content: string;
  citations: string[];
  followUpSuggestions: string[];
  modelUsed: string;
  tokens?: TokenUsageMetrics;
  durationMs?: number;
}

export interface ConceptRequest {
  projectTitle: string;
  projectType?: string;
  siteDimensions?: string;
  locationClimate?: string;
  intendedUsers?: string;
  functionalRequirements?: string;
  preferredStyle?: string;
  materialPreferences?: string;
  sustainabilityRequirements?: string;
  additionalNotes?: string;
}

export interface MaterialPaletteItem {
  name: string;
  description: string;
  role: string;
}

export interface ConceptAlternative {
  title: string;
  description: string;
  contrast: string;
}

export interface ConceptResponse {
  id: string;
  title: string;
  timestamp: string;
  tagline: string;
  designNarrative: string;
  designRationale: string;
  spatialStrategy: string[];
  circulationIdeas: string[];
  daylightVentilation: string[];
  materialPalette: MaterialPaletteItem[];
  facadeSuggestions: string[];
  sustainabilityStrategies: string[];
  alternatives: ConceptAlternative[];
  inputSummary: ConceptRequest;
  modelUsed: string;
  tokens?: TokenUsageMetrics;
  durationMs?: number;
}

export interface VivaQuestionItem {
  question: string;
  intent: string;
  keyPointsToAddress: string[];
  suggestedAnswerGuide: string;
}

export interface PortfolioRequest {
  type: string;
  projectTitle: string;
  keyDetails?: string;
}

export interface PortfolioResponse {
  title: string;
  content: string;
  questions?: VivaQuestionItem[];
  modelUsed: string;
  tokens?: TokenUsageMetrics;
  durationMs?: number;
}

export interface ModuleUsage {
  total: number;
  tutor: number;
  concept: number;
  portfolio: number;
  tokensEstimated: number;
  dailyRequestsUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
  lastRequestTime?: string;
}

