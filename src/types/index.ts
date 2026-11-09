export type NavItem = {
  label: string;
  href: string;
  isExternal?: boolean;
};

export type FeatureTool = {
  id: string;
  number: string;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  icon: string;
  path: string;
  badge?: string;
};

// Architecture Tutor Types
export type TutorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  topic?: string;
  citations?: string[];
  followUpSuggestions?: string[];
  isSaved?: boolean;
};

export type TutorTopic = {
  id: string;
  title: string;
  description: string;
  sampleQuestion: string;
  category: 'history' | 'theory' | 'materials' | 'sustainability' | 'studio';
};

// Concept Generator Types
export type ConceptInput = {
  projectTitle: string;
  projectType: string;
  siteDimensions: string;
  locationClimate: string;
  intendedUsers: string;
  functionalRequirements: string;
  preferredStyle: string;
  materialPreferences: string;
  sustainabilityRequirements: string;
  additionalNotes?: string;
};

export type ConceptResult = {
  id: string;
  title: string;
  timestamp: string;
  tagline: string;
  designNarrative: string;
  designRationale: string;
  spatialStrategy: string[];
  circulationIdeas: string[];
  daylightVentilation: string[];
  materialPalette: { name: string; description: string; role: string }[];
  facadeSuggestions: string[];
  sustainabilityStrategies: string[];
  alternatives: {
    title: string;
    description: string;
    contrast: string;
  }[];
  inputSummary: ConceptInput;
};

// Jury & Portfolio Types
export type ContentType = 
  | 'project-description'
  | 'abstract'
  | 'concept-statement'
  | 'presentation-outline'
  | 'jury-viva-questions'
  | 'portfolio-narrative'
  | 'design-rationale';

export type PortfolioDraft = {
  id: string;
  projectId?: string;
  contentType: ContentType;
  title: string;
  content: string;
  lastEdited: string;
  wordCount: number;
};

export type VivaQuestion = {
  question: string;
  intent: string;
  keyPointsToAddress: string[];
  suggestedAnswerGuide: string;
};

// Project Library Types
export type ProjectCategory = 'Academic' | 'Competition' | 'Studio' | 'Personal' | 'Thesis';

export type ProjectFile = {
  id: string;
  name: string;
  size: string;
  type: 'drawing' | 'model' | 'render' | 'pdf' | 'notes';
  uploadDate: string;
  url?: string;
};

export type Project = {
  id: string;
  title: string;
  semester: string;
  subject?: string;
  category: ProjectCategory;
  year: number;
  siteLocation: string;
  siteDimensions?: string;
  siteArea: string;
  typology: string;
  description: string;
  architecturalStyle?: string;
  startDate?: string;
  expectedCompletionDate?: string;
  designRequirements?: string;
  status: 'In Progress' | 'Completed' | 'Review Ready';
  coverImage?: string;
  files: ProjectFile[];
  notes: string[];
  savedConceptsCount: number;
  createdAt: string;
  updatedAt: string;
};

// Gallery Types
export type GalleryTradition = 
  | 'Hindu Temples'
  | 'Classical European'
  | 'Gothic'
  | 'Renaissance'
  | 'Courtyards & Haveli'
  | 'Stepwells & Water'
  | 'Sustainable & Earth'
  | 'Contemporary';

export type GalleryItem = {
  id: string;
  title: string;
  subtitle: string;
  tradition: GalleryTradition;
  era: string;
  location: string;
  description: string;
  architecturalElements: string[];
  image: string;
  thumbnail: string;
  featured?: boolean;
};

// User Profile & Settings Types
export type UserProfile = {
  fullName: string;
  email: string;
  role: string;
  university: string;
  semester: string;
  interests: string[];
  bio: string;
  avatarInitials: string;
};

export type AppSettings = {
  parchmentWarmth: 'soft' | 'standard' | 'deep';
  highContrastMode: boolean;
  reducedMotion: boolean;
  fontSize: 'standard' | 'large';
  geminiApiKeyConfigured: boolean;
  autoSaveIntervalSec: number;
};

export type UsageMetrics = {
  totalRequests: number;
  tokensUsed: number;
  dailyRequestsUsed: number;
  dailyLimit: number;
  monthlyTokensUsed: number;
  monthlyLimit: number;
  storageBytesUsed: number;
  maxStorageBytes: number;
};

