import { ConceptInput, ConceptResult, VivaQuestion } from '@/types';
import { storageService } from './storageService';
import { resolveApiUrl } from './apiClient';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem('anchora_auth_token_v1');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Ignore localStorage access issues
  }
  return headers;
}

export const aiService = {
  /**
   * Generates architectural inquiry response using official Google Gemini API via backend
   */
  async askTutor(
    question: string,
    topic?: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    conversationId?: string
  ): Promise<{
    content: string;
    citations: string[];
    followUpSuggestions: string[];
    modelUsed?: string;
    conversationId?: string;
  }> {
    try {
      const response = await fetch(resolveApiUrl('/api/ai/tutor'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question, topic, history, conversationId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Tutor API returned status ${response.status}`);
      }

      const data = await response.json();
      storageService.recordMockAiRequest(480);
      return data;
    } catch (err: any) {
      // If server is not running on port 5000 or network fails
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Could not connect to the Anchora backend server. Please run "npm run server" to start the Gemini API backend.');
      }
      throw err;
    }
  },

  /**
   * Generates comprehensive architectural concepts from project inputs using Google Gemini API
   */
  async generateConcept(input: ConceptInput & { projectId?: string }): Promise<ConceptResult & { savedOutputId?: string }> {
    try {
      const response = await fetch(resolveApiUrl('/api/ai/concept'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Concept Generator API returned status ${response.status}`);
      }

      const data = await response.json();
      storageService.recordMockAiRequest(850);
      return data;
    } catch (err: any) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Could not connect to the Anchora backend server. Please run "npm run server" to start the Gemini API backend.');
      }
      throw err;
    }
  },

  /**
   * Generates Jury defense and portfolio text assets using Google Gemini API
   */
  async generatePortfolioAsset(
    type: string,
    projectTitle: string,
    keyDetails?: string,
    projectId?: string
  ): Promise<{ title: string; content: string; questions?: VivaQuestion[]; modelUsed?: string; savedOutputId?: string }> {
    try {
      const response = await fetch(resolveApiUrl('/api/ai/portfolio'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type, projectTitle, keyDetails, projectId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Jury & Portfolio API returned status ${response.status}`);
      }

      const data = await response.json();
      storageService.recordMockAiRequest(550);
      return data;
    } catch (err: any) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Could not connect to the Anchora backend server. Please run "npm run server" to start the Gemini API backend.');
      }
      throw err;
    }
  },

  /**
   * Check backend health and Gemini API configuration
   */
  async checkHealth(): Promise<{ configured: boolean; model: string } | null> {
    try {
      const response = await fetch(resolveApiUrl('/api/health'));
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Get application level usage statistics
   */
  async getUsageStats() {
    try {
      const response = await fetch(resolveApiUrl('/api/ai/usage'));
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch {
      return null;
    }
  }
};
