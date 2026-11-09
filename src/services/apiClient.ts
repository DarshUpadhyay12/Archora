const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL : '').replace(/\/$/, '');

export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

const TOKEN_KEY = 'anchora_auth_token_v1';
const USER_KEY = 'anchora_auth_user_v1';

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  university?: string;
  semester?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
  expiresAt: string;
}

export interface ProjectNoteResponse {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface SavedOutputResponse {
  id: string;
  user_id: string;
  project_id?: string | null;
  project_title?: string | null;
  type: string;
  title: string;
  content: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface FileResponse {
  id: string;
  user_id: string;
  project_id: string | null;
  project_title?: string | null;
  original_filename: string;
  storage_filename: string;
  storage_path: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  description: string;
  category: string;
  created_at: string;
  updated_at: string;
  google_drive_file_id?: string | null;
  cloud_storage_status?: 'local' | 'synced' | 'cloud_only' | 'pending_upload' | 'pending_delete';
  cloud_web_view_link?: string | null;
  cloud_thumbnail_link?: string | null;
  cloud_md5_checksum?: string | null;
}

export interface ConversationResponse {
  id: string;
  user_id: string;
  project_id?: string | null;
  module: 'tutor' | 'concept' | 'portfolio' | string;
  title: string;
  topic: string;
  created_at: string;
  updated_at: string;
  messages_count?: number;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations_json: string;
  follow_up_suggestions_json: string;
  token_count: number;
  created_at: string;
}

export interface ProjectResponse {
  id: string;
  user_id: string;
  title: string;
  category: string;
  semester: string;
  subject: string;
  year: number;
  site_location: string;
  site_dimensions: string;
  site_area: string;
  typology: string;
  description: string;
  architectural_style: string;
  start_date: string;
  expected_completion_date: string;
  design_requirements: string;
  notes: string;
  status: 'In Progress' | 'Completed' | 'Review Ready';
  created_at: string;
  updated_at: string;
}

class ApiClient {
  private getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public setSession(token: string, user: UserResponse): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem('anchora_auth_session_v1', JSON.stringify({
        email: user.email,
        name: user.full_name,
        role: user.role,
        loginTime: new Date().toISOString(),
      }));
      window.dispatchEvent(new Event('anchora-auth-change'));
    } catch (e) {
      console.warn('[ApiClient] Failed to save session:', e);
    }
  }

  public clearSession(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('anchora_auth_session_v1');
      window.dispatchEvent(new Event('anchora-auth-change'));
    } catch (e) {
      console.warn('[ApiClient] Failed to clear session:', e);
    }
  }

  public getStoredUser(): UserResponse | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public hasToken(): boolean {
    return !!this.getToken();
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(resolveApiUrl(path), {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || `Request failed with status ${response.status}`;
      if (response.status === 401 && token) {
        this.clearSession();
      }
      throw new Error(errorMsg);
    }

    return data as T;
  }

  public async get<T>(path: string, options?: { params?: Record<string, string | undefined> }): Promise<T> {
    let url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;
    if (options?.params) {
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined) search.set(k, v);
      }
      const s = search.toString();
      if (s) url += `?${s}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  public async post<T>(path: string, body?: any): Promise<T> {
    const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;
    return this.request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async put<T>(path: string, body?: any): Promise<T> {
    const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;
    return this.request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T>(path: string): Promise<T> {
    const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;
    return this.request<T>(url, { method: 'DELETE' });
  }

  // Auth Endpoints
  async register(params: {
    email: string;
    password: string;
    fullName: string;
    university?: string;
    semester?: string;
    bio?: string;
  }): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    this.setSession(res.token, res.user);
    return res;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setSession(res.token, res.user);
    return res;
  }

  async logout(): Promise<void> {
    const token = this.getToken();
    if (token) {
      try {
        await this.request('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore network errors on logout
      }
    }
    this.clearSession();
  }

  async getMe(): Promise<UserResponse | null> {
    try {
      const res = await this.request<{ user: UserResponse }>('/api/auth/me');
      if (res.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      }
      return res.user;
    } catch {
      return null;
    }
  }

  // Projects Endpoints
  async getProjects(params?: {
    search?: string;
    category?: string;
    status?: string;
    semester?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ projects: ProjectResponse[]; count: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.status) query.set('status', params.status);
    if (params?.semester) query.set('semester', params.semester);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

    const queryString = query.toString();
    const url = `/api/projects${queryString ? `?${queryString}` : ''}`;
    return this.request<{ projects: ProjectResponse[]; count: number }>(url);
  }

  async createProject(data: Partial<ProjectResponse> & { title: string }): Promise<{ project: ProjectResponse }> {
    return this.request<{ project: ProjectResponse }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProjectById(id: string): Promise<{
    project: ProjectResponse;
    notes: ProjectNoteResponse[];
    savedOutputs: SavedOutputResponse[];
  }> {
    return this.request<{
      project: ProjectResponse;
      notes: ProjectNoteResponse[];
      savedOutputs: SavedOutputResponse[];
    }>(`/api/projects/${id}`);
  }

  async updateProject(
    id: string,
    data: Partial<ProjectResponse>
  ): Promise<{ project: ProjectResponse }> {
    return this.request<{ project: ProjectResponse }>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Project Notes Endpoints
  async addProjectNote(projectId: string, content: string, author?: string): Promise<{ note: ProjectNoteResponse }> {
    return this.request<{ note: ProjectNoteResponse }>(`/api/projects/${projectId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, author }),
    });
  }

  async updateProjectNote(projectId: string, noteId: string, content: string): Promise<{ note: ProjectNoteResponse }> {
    return this.request<{ note: ProjectNoteResponse }>(`/api/projects/${projectId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteProjectNote(projectId: string, noteId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/projects/${projectId}/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  // Saved Outputs Endpoints (AI Linking & History)
  async getSavedOutputs(params?: {
    type?: string;
    projectId?: string;
    search?: string;
    sortBy?: 'newest' | 'oldest';
    limit?: number;
    offset?: number;
  }): Promise<{ outputs: SavedOutputResponse[]; count: number }> {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return this.request<{ outputs: SavedOutputResponse[]; count: number }>(`/api/saved-outputs${queryString ? `?${queryString}` : ''}`);
  }

  async getSavedOutputById(id: string): Promise<{ output: SavedOutputResponse }> {
    return this.request<{ output: SavedOutputResponse }>(`/api/saved-outputs/${id}`);
  }

  async createSavedOutput(data: {
    projectId?: string;
    type: string;
    title: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<{ output: SavedOutputResponse }> {
    return this.request<{ output: SavedOutputResponse }>('/api/saved-outputs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSavedOutput(
    id: string,
    data: {
      title?: string;
      projectId?: string | null;
      content?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ output: SavedOutputResponse }> {
    return this.request<{ output: SavedOutputResponse }>(`/api/saved-outputs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSavedOutput(id: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/api/saved-outputs/${id}`, {
      method: 'DELETE',
    });
  }

  // Conversations Endpoints (Architecture Tutor & AI Chat History)
  async getConversations(params?: {
    module?: string;
    projectId?: string;
    search?: string;
    sortBy?: 'newest' | 'oldest';
    limit?: number;
    offset?: number;
  }): Promise<{ conversations: ConversationResponse[]; count: number }> {
    const query = new URLSearchParams();
    if (params?.module) query.set('module', params.module);
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return this.request<{ conversations: ConversationResponse[]; count: number }>(`/api/conversations${queryString ? `?${queryString}` : ''}`);
  }

  async getConversationById(id: string): Promise<{
    conversation: ConversationResponse;
    messages: MessageResponse[];
  }> {
    return this.request<{
      conversation: ConversationResponse;
      messages: MessageResponse[];
    }>(`/api/conversations/${id}`);
  }

  async createConversation(data: {
    module: string;
    title: string;
    topic?: string;
    projectId?: string;
  }): Promise<{ conversation: ConversationResponse }> {
    return this.request<{ conversation: ConversationResponse }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateConversation(
    id: string,
    data: {
      title?: string;
      topic?: string;
      projectId?: string | null;
    }
  ): Promise<{ conversation: ConversationResponse }> {
    return this.request<{ conversation: ConversationResponse }>(`/api/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteConversation(id: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/api/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  async getConversationMessages(conversationId: string): Promise<{ messages: MessageResponse[] }> {
    return this.request<{ messages: MessageResponse[] }>(`/api/conversations/${conversationId}/messages`);
  }

  async addConversationMessage(
    conversationId: string,
    data: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      citations?: string[];
      followUpSuggestions?: string[];
      tokenCount?: number;
    }
  ): Promise<{ message: MessageResponse }> {
    return this.request<{ message: MessageResponse }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================================
  // PHASE 6: ARCHITECTURAL FILE MANAGEMENT APIS
  // ==========================================

  getFilePreviewUrl(id: string): string {
    const token = this.getToken();
    return `/api/files/${id}/preview${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }

  getFileDownloadUrl(id: string): string {
    const token = this.getToken();
    return `/api/files/${id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }

  async getFiles(filters?: {
    projectId?: string | null;
    category?: string;
    fileType?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ files: FileResponse[]; count: number }> {
    const params = new URLSearchParams();
    if (filters?.projectId !== undefined && filters.projectId !== null) {
      params.set('projectId', filters.projectId);
    }
    if (filters?.category && filters.category !== 'All') {
      params.set('category', filters.category);
    }
    if (filters?.fileType && filters.fileType !== 'all') {
      params.set('fileType', filters.fileType);
    }
    if (filters?.search) {
      params.set('search', filters.search);
    }
    if (filters?.sortBy) {
      params.set('sortBy', filters.sortBy);
    }
    if (filters?.sortOrder) {
      params.set('sortOrder', filters.sortOrder);
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ files: FileResponse[]; count: number }>(`/api/files${query}`);
  }

  async getFileById(id: string): Promise<{ file: FileResponse }> {
    return this.request<{ file: FileResponse }>(`/api/files/${id}`);
  }

  async updateFile(
    id: string,
    data: {
      original_filename?: string;
      description?: string;
      category?: string;
      project_id?: string | null;
    }
  ): Promise<{ success: boolean; file: FileResponse }> {
    return this.request<{ success: boolean; file: FileResponse }>(`/api/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFile(id: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/api/files/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Uploads multiple files with progress callback using XMLHttpRequest.
   */
  uploadFiles(
    files: File[],
    options?: {
      projectId?: string | null;
      category?: string;
      description?: string;
    },
    onProgress?: (percent: number) => void
  ): Promise<{ success: boolean; count: number; files: FileResponse[]; message?: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      files.forEach((file) => {
        formData.append('files', file);
      });

      if (options?.projectId) {
        formData.append('project_id', options.projectId);
      }
      if (options?.category) {
        formData.append('category', options.category);
      }
      if (options?.description) {
        formData.append('description', options.description);
      }

      xhr.open('POST', '/api/files/upload', true);

      const token = this.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('x-auth-token', token);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
          } else {
            reject(new Error(res.error || `Upload failed with HTTP ${xhr.status}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse upload server response: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during file upload.'));
      };

      xhr.send(formData);
    });
  }

  // ==========================================
  // PHASE 7: PROFESSIONAL PDF EXPORT APIS
  // ==========================================

  async exportPdf(params: {
    exportType: 'project_report' | 'concept_report' | 'tutor_notes' | 'jury_prep' | 'portfolio' | string;
    targetId: string;
    options?: {
      title?: string;
      subtitle?: string;
      authorName?: string;
      institutionName?: string;
      date?: string;
      pageSize?: 'A4' | 'A3';
      orientation?: 'portrait' | 'landscape';
      sections?: { [key: string]: boolean };
      includeImages?: boolean;
    };
  }): Promise<{
    success: boolean;
    exportId: string;
    documentTitle: string;
    filename: string;
    sizeBytes: number;
    pdfBase64: string;
  }> {
    return this.request<{
      success: boolean;
      exportId: string;
      documentTitle: string;
      filename: string;
      sizeBytes: number;
      pdfBase64: string;
    }>('/api/export/pdf', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getExportHistory(): Promise<{ history: any[]; count: number }> {
    return this.request<{ history: any[]; count: number }>('/api/export/history');
  }

  async deleteExportHistory(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/export/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // AI USAGE & LIMIT MANAGEMENT (PHASE 8)
  // ==========================================

  async getAiUsageSummary(period: 'today' | '7d' | '30d' | 'all' = '30d'): Promise<{
    status: string;
    summary: {
      period: 'today' | '7d' | '30d' | 'all';
      dateRange: { start: string | null; end: string };
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      totalTokens: number | null;
      promptTokens: number | null;
      candidatesTokens: number | null;
      tokensRecordedCount: number;
      tokensUnavailableCount: number;
      moduleCounts: {
        tutor: { total: number; success: number; failed: number; tokens: number | null };
        concept: { total: number; success: number; failed: number; tokens: number | null };
        portfolio: { total: number; success: number; failed: number; tokens: number | null };
      };
      timeline: Array<{
        date: string;
        total: number;
        success: number;
        failed: number;
        tokens: number | null;
      }>;
      recentModules: Array<{
        module: string;
        lastUsed: string;
        totalCalls: number;
      }>;
    };
  }> {
    return this.request(`/api/ai/usage/summary?period=${period}`);
  }

  async getAiUsageHistory(params: {
    page?: number;
    limit?: number;
    module?: string;
    status?: string;
    period?: string;
  } = {}): Promise<{
    status: string;
    events: Array<{
      id: string;
      user_id?: string | null;
      request_id?: string | null;
      module: string;
      model_name: string;
      status: 'success' | 'error' | 'rate_limited';
      prompt_tokens?: number | null;
      candidates_tokens?: number | null;
      total_tokens?: number | null;
      error_category?: string | null;
      duration_ms: number;
      input_chars: number;
      created_at: string;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.module) q.set('module', params.module);
    if (params.status) q.set('status', params.status);
    if (params.period) q.set('period', params.period);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/api/ai/usage/history${qs}`);
  }

  async getAiLimits(): Promise<{
    status: string;
    limits: {
      id: string;
      max_requests_per_day: number;
      max_requests_per_month: number;
      max_input_chars: number;
      max_concurrent_requests: number;
      daily_warning_threshold: number;
      monthly_warning_threshold: number;
    };
    activeConcurrent: number;
    dailyRequestsUsed: number;
    monthlyRequestsUsed: number;
    dailyRemaining: number;
    monthlyRemaining: number;
    isDailyWarning: boolean;
    isDailyExceeded: boolean;
    isMonthlyWarning: boolean;
    isMonthlyExceeded: boolean;
  }> {
    return this.request('/api/ai/limits');
  }

  async updateAiLimits(updates: {
    max_requests_per_day?: number;
    max_requests_per_month?: number;
    max_input_chars?: number;
    max_concurrent_requests?: number;
    daily_warning_threshold?: number;
    monthly_warning_threshold?: number;
  }): Promise<{ status: string; limits: any; message: string }> {
    return this.request('/api/ai/limits', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getAiHealth(): Promise<{
    status: string;
    configured: boolean;
    model: string;
    isFreeTier: boolean;
    lastSuccess: { timestamp: string; module: string; model: string } | null;
    lastError: { timestamp: string; module: string; errorCategory: string | null } | null;
    timestamp: string;
  }> {
    return this.request('/api/ai/health');
  }

  // ==========================================
  // LOCAL BACKUP & RESTORE SYSTEM (PHASE 9)
  // ==========================================

  async createBackup(customFilename?: string): Promise<{
    success: boolean;
    backup: {
      id: string;
      filename: string;
      file_path: string;
      file_size_bytes: number;
      backup_version: string;
      schema_version: number;
      is_automatic: number;
      file_count: number;
      created_at: string;
    };
    manifest: any;
    filename: string;
    message: string;
  }> {
    return this.request('/api/backup', {
      method: 'POST',
      body: JSON.stringify({ customFilename }),
    });
  }

  async getBackupHistory(): Promise<{
    success: boolean;
    backups: Array<{
      filename: string;
      filePath: string;
      sizeBytes: number;
      createdAt: string;
      backupVersion: string;
      schemaVersion: number;
      isAutomatic: boolean;
      fileCount: number;
      manifest?: any;
      integrityOk: boolean;
    }>;
    count: number;
  }> {
    return this.request('/api/backup/history');
  }

  async verifyBackup(filename: string): Promise<{
    success: boolean;
    valid: boolean;
    errors: string[];
    manifest?: any;
    archiveSize: number;
    filename: string;
  }> {
    return this.request('/api/backup/verify', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    });
  }

  async downloadBackup(filename: string): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-auth-token'] = token;
    }

    const res = await fetch(resolveApiUrl(`/api/backup/download/${encodeURIComponent(filename)}`), {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async restoreBackup(options: {
    filename?: string;
    backupFile?: File;
  }): Promise<{
    success: boolean;
    restoredAt: string;
    manifest: any;
    stats: {
      usersRestored: number;
      projectsRestored: number;
      filesRestored: number;
      conversationsRestored: number;
    };
    message: string;
  }> {
    if (options.backupFile) {
      const formData = new FormData();
      formData.append('backupFile', options.backupFile);

      const token = this.getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-auth-token'] = token;
      }

      const res = await fetch(resolveApiUrl('/api/backup/restore'), {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Restoration failed.' }));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      return res.json();
    }

    return this.request('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ filename: options.filename }),
    });
  }

  async deleteBackup(filename: string): Promise<{
    success: boolean;
    deletedFilename: string;
    message: string;
  }> {
    return this.request(`/api/backup/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
  }

  async getBackupSettings(): Promise<{
    success: boolean;
    autoBackup: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'manual';
      maxRetained: number;
      destination: string;
      lastRun: string | null;
    };
  }> {
    return this.request('/api/backup/settings');
  }

  async updateBackupSettings(settings: {
    enabled?: boolean;
    frequency?: 'daily' | 'weekly' | 'manual';
    maxRetained?: number;
    destination?: string;
  }): Promise<{
    success: boolean;
    settings: any;
    message: string;
  }> {
    return this.request('/api/backup/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Google Drive Cloud Backup Endpoints
  async getGoogleDriveStatus(): Promise<{
    success: boolean;
    status: {
      configured: boolean;
      connected: boolean;
      googleEmail?: string | null;
      googleName?: string | null;
      googlePicture?: string | null;
      folderId: string;
      folderName?: string | null;
      folderStatus: 'unverified' | 'verified' | 'inaccessible' | 'permission_denied';
      canUpload: boolean;
      lastVerified?: string | null;
      lastBackup?: string | null;
      googlePickerApiKeyConfigured?: boolean;
    };
  }> {
    return this.request('/api/google/status');
  }

  async getGoogleAuthUrl(): Promise<{
    success: boolean;
    authUrl: string;
  }> {
    return this.request('/api/google/auth-url');
  }

  async verifyGoogleDriveFolder(folderId?: string): Promise<{
    success: boolean;
    folder: {
      id: string;
      name: string;
      exists: boolean;
      isFolder: boolean;
      trashed: boolean;
      canAddChildren: boolean;
      webViewLink?: string;
      error?: string;
    };
  }> {
    return this.request('/api/google/verify-folder', {
      method: 'POST',
      body: JSON.stringify({ folderId }),
    });
  }

  async setGoogleDriveFolder(folderId: string, folderName?: string): Promise<{
    success: boolean;
    folder: {
      id: string;
      name: string;
      exists: boolean;
      isFolder: boolean;
      trashed: boolean;
      canAddChildren: boolean;
      webViewLink?: string;
      error?: string;
    };
  }> {
    return this.request('/api/google/set-folder', {
      method: 'POST',
      body: JSON.stringify({ folderId, folderName }),
    });
  }

  async uploadCloudBackup(options: {
    customFilename?: string;
    folderId?: string;
  } = {}): Promise<{
    success: boolean;
    cloudBackup: any;
    webViewLink?: string;
    message: string;
  }> {
    return this.request('/api/google/backup/upload', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async listCloudBackups(folderId?: string): Promise<{
    success: boolean;
    folderId: string;
    folderName: string | null;
    folderStatus: string;
    count: number;
    backups: Array<{
      id: string;
      fileId: string;
      filename: string;
      sizeBytes: number;
      createdAt: string;
      uploadedAt: string;
      folderId: string;
      md5Checksum?: string;
      sha256Checksum?: string;
      webViewLink?: string;
    }>;
  }> {
    const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
    return this.request(`/api/google/backup/list${query}`);
  }

  async downloadCloudBackup(fileId: string, filename: string): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-auth-token'] = token;
    }

    const res = await fetch(resolveApiUrl(`/api/google/backup/download/${encodeURIComponent(fileId)}`), {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'Archora-Cloud-Backup.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async verifyCloudBackup(fileId: string): Promise<{
    success: boolean;
    verification: any;
  }> {
    return this.request(`/api/google/backup/verify/${encodeURIComponent(fileId)}`, {
      method: 'POST',
    });
  }

  async restoreFromCloudBackup(fileId: string): Promise<{
    success: boolean;
    message: string;
    result: any;
  }> {
    return this.request(`/api/google/backup/restore/${encodeURIComponent(fileId)}`, {
      method: 'POST',
    });
  }

  async deleteCloudBackup(fileId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/google/backup/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    });
  }

  async disconnectGoogleDrive(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('/api/google/disconnect', {
      method: 'POST',
    });
  }

  // ==========================================
  // GOOGLE DRIVE PRIMARY STORAGE & DATA SYNC
  // ==========================================

  async getStorageSummary(): Promise<StorageOverviewResponse> {
    return this.request<StorageOverviewResponse>('/api/files/storage/summary');
  }

  async getSyncStatus(): Promise<CloudSyncStatusResponse> {
    return this.request<CloudSyncStatusResponse>('/api/sync/status');
  }

  async triggerSyncNow(): Promise<{
    success: boolean;
    message: string;
    snapshotDriveFileId: string;
    version: number;
    syncedAt: string;
    totalSyncedProjects: number;
    totalSyncedConversations: number;
    totalSyncedFiles: number;
    webViewLink?: string;
  }> {
    return this.request('/api/sync/now', {
      method: 'POST',
    });
  }

  async pullSyncSnapshot(snapshotDriveFileId: string): Promise<{
    success: boolean;
    message: string;
    restored: {
      restoredProjects: number;
      restoredNotes: number;
      restoredConversations: number;
      restoredMessages: number;
      restoredOutputs: number;
      restoredFilesMetadata: number;
    };
  }> {
    return this.request('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ snapshotDriveFileId }),
    });
  }

  async processOfflineSyncQueue(): Promise<{
    success: boolean;
    message: string;
    processed: number;
    failed: number;
    remaining: number;
  }> {
    return this.request('/api/sync/process-queue', {
      method: 'POST',
    });
  }
}

export interface StorageOverviewResponse {
  localDatabaseBytes: number;
  localDatabaseFormatted: string;
  cloudFilesCount: number;
  cloudFilesSizeBytes: number;
  cloudFilesSizeFormatted: string;
  localFilesCount: number;
  localFilesSizeBytes: number;
  localFilesSizeFormatted: string;
  savedLocalDiskBytes: number;
  savedLocalDiskFormatted: string;
  freeDiskBytes: number;
  freeDiskFormatted: string;
  isLowDiskSpace: boolean;
  targetFolderId: string;
  folderVerified: boolean;
  googleConnected: boolean;
}

export interface CloudSyncStatusResponse {
  syncState: {
    user_id: string;
    sync_status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
    last_sync_at: string | null;
    snapshot_drive_file_id: string | null;
    snapshot_version: number;
    total_synced_projects: number;
    total_synced_conversations: number;
    total_synced_files: number;
    auto_sync_enabled: number;
    error_message: string | null;
  };
  pendingQueueCount: number;
  storage: StorageOverviewResponse;
}

export const apiClient = new ApiClient();
