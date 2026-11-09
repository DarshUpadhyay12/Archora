import { 
  Project, 
  ProjectCategory,
  TutorMessage, 
  ConceptResult, 
  PortfolioDraft, 
  UserProfile, 
  AppSettings, 
  UsageMetrics 
} from '@/types';
import { 
  INITIAL_USER_PROFILE, 
  INITIAL_USAGE_METRICS 
} from '@/data/mockData';
import { apiClient, ProjectResponse } from './apiClient';

export function mapDbProjectToFrontend(p: ProjectResponse): Project {
  let parsedNotes: string[] = [];
  try {
    parsedNotes = JSON.parse(p.notes || '[]');
  } catch {
    parsedNotes = [];
  }

  return {
    id: p.id,
    title: p.title,
    category: (p.category as ProjectCategory) || 'Studio',
    semester: p.semester || 'Semester 7',
    subject: p.subject || '',
    year: p.year || 2026,
    siteLocation: p.site_location || 'Site Unspecified',
    siteDimensions: p.site_dimensions || '',
    siteArea: p.site_area || '3,200 sq.m',
    typology: p.typology || 'Architectural Project',
    description: p.description || '',
    architecturalStyle: p.architectural_style || '',
    startDate: p.start_date || '',
    expectedCompletionDate: p.expected_completion_date || '',
    designRequirements: p.design_requirements || '',
    status: p.status || 'In Progress',
    coverImage: '/images/architecture/projects_sketch.jpg',
    files: [],
    notes: parsedNotes,
    savedConceptsCount: 0,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export interface AuthSession {
  email: string;
  name: string;
  role: string;
  loginTime: string;
}

const KEYS = {
  PROJECTS: 'anchora_projects_v1',
  TUTOR_MESSAGES: 'anchora_tutor_messages_v1',
  CONCEPTS: 'anchora_concepts_v1',
  PORTFOLIO_DRAFTS: 'anchora_portfolio_drafts_v1',
  PROFILE: 'anchora_profile_v1',
  SETTINGS: 'anchora_settings_v1',
  USAGE: 'anchora_usage_v1',
  AUTH: 'anchora_auth_session_v1',
};

const DEFAULT_SETTINGS: AppSettings = {
  parchmentWarmth: 'standard',
  highContrastMode: false,
  reducedMotion: false,
  fontSize: 'standard',
  geminiApiKeyConfigured: true,
  autoSaveIntervalSec: 30,
};

// Safe localStorage access wrapper
function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[Anchora Storage] Error reading key ${key}:`, e);
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Anchora Storage] Error writing key ${key}:`, e);
  }
}

export const storageService = {
  // Authentication & Session
  getAuthSession(): AuthSession | null {
    return getItem<AuthSession | null>(KEYS.AUTH, null);
  },

  async loginServer(email: string, password: string): Promise<AuthSession> {
    const res = await apiClient.login(email, password);
    const session: AuthSession = {
      email: res.user.email,
      name: res.user.full_name,
      role: res.user.role || 'Architecture Student',
      loginTime: new Date().toISOString(),
    };
    setItem(KEYS.AUTH, session);
    window.dispatchEvent(new Event('anchora-auth-change'));
    return session;
  },

  async registerServer(params: {
    email: string;
    password: string;
    fullName: string;
    university?: string;
    semester?: string;
    bio?: string;
  }): Promise<AuthSession> {
    const res = await apiClient.register(params);
    const session: AuthSession = {
      email: res.user.email,
      name: res.user.full_name,
      role: res.user.role || 'Architecture Student',
      loginTime: new Date().toISOString(),
    };
    setItem(KEYS.AUTH, session);
    window.dispatchEvent(new Event('anchora-auth-change'));
    return session;
  },

  login(email: string, name?: string): AuthSession {
    const session: AuthSession = {
      email,
      name: name || email.split('@')[0],
      role: 'Architecture Student',
      loginTime: new Date().toISOString(),
    };
    setItem(KEYS.AUTH, session);
    window.dispatchEvent(new Event('anchora-auth-change'));
    return session;
  },

  logout(): void {
    apiClient.logout().catch(() => {});
    localStorage.removeItem(KEYS.AUTH);
    window.dispatchEvent(new Event('anchora-auth-change'));
  },

  isAuthenticated(): boolean {
    return !!this.getAuthSession();
  },

  // Projects
  async fetchProjectsServer(filters?: {
    search?: string;
    category?: string;
    status?: string;
    semester?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<Project[]> {
    try {
      const res = await apiClient.getProjects(filters);
      const mapped = res.projects.map(mapDbProjectToFrontend);
      setItem(KEYS.PROJECTS, mapped);
      return mapped;
    } catch (e) {
      console.warn('[Anchora Storage] Error fetching projects from server, falling back to cache:', e);
      return this.getProjects();
    }
  },

  async createProjectServer(data: Partial<Project> & { title: string }): Promise<Project> {
    const res = await apiClient.createProject({
      title: data.title,
      category: data.category,
      semester: data.semester,
      subject: data.subject,
      year: data.year,
      site_location: data.siteLocation,
      site_dimensions: data.siteDimensions,
      site_area: data.siteArea,
      typology: data.typology,
      description: data.description,
      architectural_style: data.architecturalStyle,
      start_date: data.startDate,
      expected_completion_date: data.expectedCompletionDate,
      design_requirements: data.designRequirements,
      notes: Array.isArray(data.notes) ? data.notes.join('\n') : (typeof data.notes === 'string' ? data.notes : undefined),
      status: data.status,
    });
    const mapped = mapDbProjectToFrontend(res.project);
    const existing = this.getProjects();
    setItem(KEYS.PROJECTS, [mapped, ...existing.filter((p) => p.id !== mapped.id)]);
    return mapped;
  },

  async updateProjectServer(id: string, updates: Partial<Project>): Promise<Project> {
    const res = await apiClient.updateProject(id, {
      title: updates.title,
      category: updates.category,
      semester: updates.semester,
      subject: updates.subject,
      year: updates.year,
      site_location: updates.siteLocation,
      site_dimensions: updates.siteDimensions,
      site_area: updates.siteArea,
      typology: updates.typology,
      description: updates.description,
      architectural_style: updates.architecturalStyle,
      start_date: updates.startDate,
      expected_completion_date: updates.expectedCompletionDate,
      design_requirements: updates.designRequirements,
      notes: Array.isArray(updates.notes) ? updates.notes.join('\n') : (typeof updates.notes === 'string' ? updates.notes : undefined),
      status: updates.status,
    });
    const mapped = mapDbProjectToFrontend(res.project);
    const existing = this.getProjects();
    setItem(KEYS.PROJECTS, existing.map((p) => (p.id === id ? mapped : p)));
    return mapped;
  },

  async deleteProjectServer(id: string): Promise<boolean> {
    await apiClient.deleteProject(id);
    const existing = this.getProjects();
    setItem(KEYS.PROJECTS, existing.filter((p) => p.id !== id));
    return true;
  },

  getProjects(): Project[] {
    return getItem<Project[]>(KEYS.PROJECTS, []);
  },

  getProjectById(id: string): Project | undefined {
    const projects = this.getProjects();
    return projects.find((p) => p.id === id);
  },

  saveProject(project: Project): Project[] {
    const projects = this.getProjects();
    const existingIndex = projects.findIndex((p) => p.id === project.id);
    let updated: Project[];
    if (existingIndex >= 0) {
      updated = [...projects];
      updated[existingIndex] = { ...project, updatedAt: new Date().toISOString() };
    } else {
      updated = [
        {
          ...project,
          id: project.id || `proj-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...projects,
      ];
    }
    setItem(KEYS.PROJECTS, updated);
    return updated;
  },

  deleteProject(id: string): Project[] {
    const projects = this.getProjects().filter((p) => p.id !== id);
    setItem(KEYS.PROJECTS, projects);
    return projects;
  },

  resetProjects(): Project[] {
    setItem(KEYS.PROJECTS, []);
    return [];
  },

  // Tutor Messages
  getTutorMessages(): TutorMessage[] {
    return getItem<TutorMessage[]>(KEYS.TUTOR_MESSAGES, []);
  },

  saveTutorMessage(message: TutorMessage): TutorMessage[] {
    const messages = this.getTutorMessages();
    const updated = [...messages, message];
    setItem(KEYS.TUTOR_MESSAGES, updated);
    return updated;
  },

  clearTutorMessages(): TutorMessage[] {
    setItem(KEYS.TUTOR_MESSAGES, []);
    return [];
  },

  // Concepts
  getSavedConcepts(): ConceptResult[] {
    return getItem<ConceptResult[]>(KEYS.CONCEPTS, []);
  },

  saveConcept(concept: ConceptResult): ConceptResult[] {
    const concepts = this.getSavedConcepts();
    const updated = [concept, ...concepts.filter((c) => c.id !== concept.id)];
    setItem(KEYS.CONCEPTS, updated);
    return updated;
  },

  deleteConcept(id: string): ConceptResult[] {
    const concepts = this.getSavedConcepts().filter((c) => c.id !== id);
    setItem(KEYS.CONCEPTS, concepts);
    return concepts;
  },

  // Portfolio Drafts
  getPortfolioDrafts(): PortfolioDraft[] {
    return getItem<PortfolioDraft[]>(KEYS.PORTFOLIO_DRAFTS, []);
  },

  savePortfolioDraft(draft: PortfolioDraft): PortfolioDraft[] {
    const drafts = this.getPortfolioDrafts();
    const idx = drafts.findIndex((d) => d.id === draft.id);
    let updated: PortfolioDraft[];
    if (idx >= 0) {
      updated = [...drafts];
      updated[idx] = draft;
    } else {
      updated = [draft, ...drafts];
    }
    setItem(KEYS.PORTFOLIO_DRAFTS, updated);
    return updated;
  },

  // User Profile
  getUserProfile(): UserProfile {
    return getItem<UserProfile>(KEYS.PROFILE, INITIAL_USER_PROFILE);
  },

  saveUserProfile(profile: UserProfile): UserProfile {
    setItem(KEYS.PROFILE, profile);
    return profile;
  },

  // App Settings
  getAppSettings(): AppSettings {
    return getItem<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  saveAppSettings(settings: AppSettings): AppSettings {
    setItem(KEYS.SETTINGS, settings);
    return settings;
  },

  // Usage Metrics (Mock Studio Counters)
  getUsageMetrics(): UsageMetrics {
    return getItem<UsageMetrics>(KEYS.USAGE, INITIAL_USAGE_METRICS);
  },

  recordMockAiRequest(tokenCount: number = 420): UsageMetrics {
    const current = this.getUsageMetrics();
    const updated: UsageMetrics = {
      ...current,
      totalRequests: current.totalRequests + 1,
      dailyRequestsUsed: current.dailyRequestsUsed + 1,
      tokensUsed: current.tokensUsed + tokenCount,
      monthlyTokensUsed: current.monthlyTokensUsed + tokenCount,
    };
    setItem(KEYS.USAGE, updated);
    return updated;
  },

  // Backup & Restore
  exportBackupJson(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projects: this.getProjects(),
      tutorMessages: this.getTutorMessages(),
      concepts: this.getSavedConcepts(),
      portfolioDrafts: this.getPortfolioDrafts(),
      profile: this.getUserProfile(),
      settings: this.getAppSettings(),
    };
    return JSON.stringify(backup, null, 2);
  },

  importBackupJson(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.projects) setItem(KEYS.PROJECTS, data.projects);
      if (data.tutorMessages) setItem(KEYS.TUTOR_MESSAGES, data.tutorMessages);
      if (data.concepts) setItem(KEYS.CONCEPTS, data.concepts);
      if (data.portfolioDrafts) setItem(KEYS.PORTFOLIO_DRAFTS, data.portfolioDrafts);
      if (data.profile) setItem(KEYS.PROFILE, data.profile);
      if (data.settings) setItem(KEYS.SETTINGS, data.settings);
      return true;
    } catch (e) {
      console.error('[Anchora Storage] Failed to restore backup:', e);
      return false;
    }
  },
};
