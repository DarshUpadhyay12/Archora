import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { 
  TutorRequest, 
  TutorResponse, 
  ConceptRequest, 
  ConceptResponse, 
  PortfolioRequest, 
  PortfolioResponse,
  TokenUsageMetrics
} from '../types';

dotenv.config();

export interface GeminiExecutionResult {
  text: string;
  tokens: TokenUsageMetrics;
  durationMs: number;
}

/**
 * Strict Zero-Cost Policy: Approved Free-Tier Gemini Models
 * Paid models (e.g. Pro, Ultra) are explicitly prohibited to prevent any billing or charges.
 */
export const ALLOWED_FREE_TIER_MODELS = new Set([
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
]);

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    const requestedModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    
    // Strict Zero-Cost Policy Enforcement: Prohibit paid models and enforce free-tier
    if (!ALLOWED_FREE_TIER_MODELS.has(requestedModel) || requestedModel.toLowerCase().includes('pro') || requestedModel.toLowerCase().includes('ultra')) {
      console.warn(`[GeminiService] ZERO-COST POLICY ACTIVE: Requested model '${requestedModel}' is not an approved free-tier model. Enforcing free-tier default: gemini-3.5-flash-lite.`);
      this.modelName = 'gemini-3.5-flash-lite';
    } else {
      this.modelName = requestedModel;
    }

    if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') {
      try {
        this.ai = new GoogleGenAI({ apiKey });
        const masked = `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`;
        console.log(`[GeminiService] Initialized with free-tier model: ${this.modelName} (Zero-Cost Policy Active, Key: ${masked})`);
      } catch (err) {
        console.error('[GeminiService] Failed to initialize GoogleGenAI client:', err);
      }
    } else {
      console.warn('[GeminiService] Warning: GEMINI_API_KEY is not set or using placeholder.');
    }
  }

  public isConfigured(): boolean {
    return !!this.ai && !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_API_KEY_HERE';
  }

  public getModelName(): string {
    return this.modelName;
  }

  /**
   * Safe execution wrapper with timeout, token extraction, and provider quota handling.
   * Guarantees ₹0 cost protection: never switches models or delegates to paid services.
   */
  private async executeWithTimeout(
    operation: () => Promise<any>,
    timeoutMs = 30000
  ): Promise<GeminiExecutionResult> {
    const startTime = Date.now();
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const timeoutErr = new Error('Request timed out while waiting for Gemini API response (30s).');
        (timeoutErr as any).errorCategory = 'timeout';
        reject(timeoutErr);
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([operation(), timeoutPromise]);
      clearTimeout(timeoutHandle!);
      const durationMs = Date.now() - startTime;

      // Extract authentic token usage strictly from SDK metadata when available
      const promptTokens = typeof res?.usageMetadata?.promptTokenCount === 'number'
        ? res.usageMetadata.promptTokenCount
        : null;
      const candidatesTokens = typeof res?.usageMetadata?.candidatesTokenCount === 'number'
        ? res.usageMetadata.candidatesTokenCount
        : null;
      const totalTokens = typeof res?.usageMetadata?.totalTokenCount === 'number'
        ? res.usageMetadata.totalTokenCount
        : (promptTokens !== null && candidatesTokens !== null ? promptTokens + candidatesTokens : null);

      return {
        text: res?.text || '',
        tokens: {
          promptTokens,
          candidatesTokens,
          totalTokens,
        },
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timeoutHandle!);

      // Provider quota & rate limit handling (HTTP 429 / RESOURCE_EXHAUSTED)
      // Strict Zero-Cost Policy: Never switch to paid models; pause and inform the user.
      if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        const quotaErr = new Error('Free-tier Gemini quota temporarily exhausted (HTTP 429 RESOURCE_EXHAUSTED). In accordance with Archora\'s Strict Zero-Cost Policy, AI requests have been paused until the free quota window resets. No paid models or billing will ever be invoked. Please retry in a few moments.');
        (quotaErr as any).status = 429;
        (quotaErr as any).isProviderQuota = true;
        (quotaErr as any).errorCategory = 'provider_quota_429';
        throw quotaErr;
      }

      // Model configuration errors
      if (err?.status === 404 || err?.message?.includes('NOT_FOUND') || err?.message?.includes('no longer available')) {
        const notFoundErr = new Error(`The configured Gemini model '${this.modelName}' is unavailable. Please check GEMINI_MODEL in .env.`);
        (notFoundErr as any).status = 404;
        (notFoundErr as any).errorCategory = 'model_unavailable';
        throw notFoundErr;
      }

      err.errorCategory = err.errorCategory || 'api_error';
      throw err;
    }
  }

  /**
   * 1. Architecture Tutor
   */
  public async askTutor(req: TutorRequest): Promise<TutorResponse> {
    if (!this.ai) {
      throw new Error('Gemini API key is not configured on the backend. Please check your .env file.');
    }

    const systemInstruction = `You are Archora Architecture Tutor, an expert architectural historian, theorist, and senior studio professor.
Your goal is to provide rigorous, educationally structured, and student-friendly explanations of architectural theories, tectonic details, history, materials, and design principles.
Structure your answer using clean GitHub markdown:
- Use ### for Section Titles
- Use bullet points with **bold keywords**
- Emphasize tectonic clarity (load transfer, materials, light, climate response)
- Include authentic citations or precedents from Vitruvius, Le Corbusier, Kenneth Frampton, Stella Kramrisch, or Francis Ching where appropriate.
At the very end of your response, output a JSON block in this exact format so the UI can parse citations and follow-up suggestions:
\`\`\`json
{
  "citations": ["Author, Work", "Author 2, Work 2"],
  "followUpSuggestions": ["Specific question 1?", "Specific question 2?"]
}
\`\`\``;

    const conversationPrompt = `Student inquiry: "${req.question}"
Topic category: ${req.topic || 'General Architectural Theory'}
${req.history && req.history.length > 0 ? `Previous Context:\n${req.history.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n')}` : ''}

Please provide an in-depth, structured architectural analysis answering the student's question.`;

    const execResult = await this.executeWithTimeout(async () => {
      return await this.ai!.models.generateContent({
        model: this.modelName,
        contents: conversationPrompt,
        config: {
          systemInstruction,
          temperature: 0.6,
        }
      });
    });

    const response = execResult.text;

    // Parse citations and suggestions from JSON block if available
    let mainContent = response;
    let citations: string[] = ['Vitruvius, De Architectura', 'Frampton, Studies in Tectonic Culture'];
    let followUpSuggestions: string[] = [
      'How does this translate into structural section drawings?',
      'What are the passive microclimate implications of this approach?'
    ];

    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed.citations)) citations = parsed.citations;
        if (Array.isArray(parsed.followUpSuggestions)) followUpSuggestions = parsed.followUpSuggestions;
        mainContent = response.replace(/```json[\s\S]*?```/, '').trim();
      } catch (e) {
        // Fallback to raw text
      }
    }

    return {
      content: mainContent,
      citations,
      followUpSuggestions,
      modelUsed: this.modelName,
      tokens: execResult.tokens,
      durationMs: execResult.durationMs,
    };
  }

  /**
   * 2. Design Concept Generator
   */
  public async generateConcept(input: ConceptRequest): Promise<ConceptResponse> {
    if (!this.ai) {
      throw new Error('Gemini API key is not configured on the backend. Please check your .env file.');
    }

    const systemInstruction = `You are Archora Generative Design Concept Engine, an award-winning senior architectural designer.
Given a studio project brief, you synthesize comprehensive, climate-responsive, tectonically sound architectural concepts.
You must respond ONLY with a valid JSON object matching the requested schema. Do not add conversational markdown outside the JSON.
Schema:
{
  "title": "Project Title with Poetic Architectural Subtitle",
  "tagline": "Concise 1-sentence architectural thesis statement",
  "designNarrative": "3-4 detailed paragraphs describing massing, threshold, courtyard, tectonic expression, and spatial experience.",
  "designRationale": "Tectonic and structural reasoning for grids, foundations, and climate adaptation.",
  "spatialStrategy": ["Point 1: Zoning & hierarchy", "Point 2: Threshold transition", "Point 3: Flexible spaces"],
  "circulationIdeas": ["Circulation point 1: Primary ambulatory", "Circulation point 2: Vertical core", "Circulation point 3: Barrier-free access"],
  "daylightVentilation": ["Ventilation 1: Passive solar orientation & eaves", "Ventilation 2: Stack effect & thermal chimney", "Ventilation 3: Daylight lux autonomy"],
  "materialPalette": [
    { "name": "Material Name", "description": "Specific finish & sourcing", "role": "Base / Superstructure / Envelope" }
  ],
  "facadeSuggestions": ["Facade 1: Colonnade depth", "Facade 2: Shading screens/jaalis", "Facade 3: Clerestory glazing"],
  "sustainabilityStrategies": ["Strategy 1: Passive energy reduction", "Strategy 2: Rainwater catchment", "Strategy 3: Embodied carbon"],
  "alternatives": [
    { "title": "Scheme Alternative A", "description": "Description of variation", "contrast": "Key architectural trade-off" }
  ]
}`;

    const prompt = `Project Title: ${input.projectTitle}
Typology: ${input.projectType || 'Cultural / Institutional'}
Site Dimensions: ${input.siteDimensions || 'Not specified'}
Location / Climate: ${input.locationClimate || 'Composite Tropical'}
Intended Users: ${input.intendedUsers || 'Students and public'}
Functional Requirements: ${input.functionalRequirements || 'Exhibition spaces, workshops, gathering areas'}
Preferred Style / Tradition: ${input.preferredStyle || 'Contemporary Regionalist / Vernacular Synthesis'}
Material Preferences: ${input.materialPreferences || 'Local stone, timber, terracotta'}
Sustainability Focus: ${input.sustainabilityRequirements || 'Passive cooling, daylight autonomy, natural ventilation'}
Studio Notes: ${input.additionalNotes || 'Ensure strong courtyard and tectonic expression'}

Synthesize the complete architectural concept strictly in valid JSON format.`;

    const execResult = await this.executeWithTimeout(async () => {
      return await this.ai!.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });
    });

    let cleaned = execResult.text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);
      return {
        id: `concept-${Date.now()}`,
        title: parsed.title || input.projectTitle,
        timestamp: 'Just now (via Gemini API)',
        tagline: parsed.tagline || 'A climate-responsive architectural synthesis.',
        designNarrative: parsed.designNarrative || '',
        designRationale: parsed.designRationale || '',
        spatialStrategy: parsed.spatialStrategy || [],
        circulationIdeas: parsed.circulationIdeas || [],
        daylightVentilation: parsed.daylightVentilation || [],
        materialPalette: parsed.materialPalette || [],
        facadeSuggestions: parsed.facadeSuggestions || [],
        sustainabilityStrategies: parsed.sustainabilityStrategies || [],
        alternatives: parsed.alternatives || [],
        inputSummary: input,
        modelUsed: this.modelName,
        tokens: execResult.tokens,
        durationMs: execResult.durationMs,
      };
    } catch (parseError) {
      console.error('[GeminiService] Failed to parse JSON concept output:', execResult.text);
      throw new Error('Received malformed response format from Gemini API. Please retry.');
    }
  }

  /**
   * 3. Jury & Portfolio Assistant
   */
  public async generatePortfolioAsset(req: PortfolioRequest): Promise<PortfolioResponse> {
    if (!this.ai) {
      throw new Error('Gemini API key is not configured on the backend. Please check your .env file.');
    }

    if (req.type === 'jury-viva-questions') {
      const systemInstruction = `You are Archora Jury Viva Examiner, a rigorous, insightful architecture critic and studio professor.
Generate 3 to 4 challenging, realistic jury viva questions testing the student's structural logic, environmental response, and circulation efficiency.
Respond ONLY with a valid JSON array of question objects:
[
  {
    "question": "Clear, challenging question a juror would ask?",
    "intent": "What pedagogical or structural vulnerability the juror is testing",
    "keyPointsToAddress": ["Specific architectural talking point 1", "Point 2", "Point 3"],
    "suggestedAnswerGuide": "Strategic framing on how to defend with confidence using architectural principles."
  }
]`;

      const prompt = `Project Title: ${req.projectTitle}
Focus / Vulnerabilities: ${req.keyDetails || 'General architectural review'}

Generate predicted jury viva questions with defense strategies in JSON format.`;

      const execResult = await this.executeWithTimeout(async () => {
        return await this.ai!.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.6
          }
        });
      });

      let cleaned = execResult.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      try {
        const questions = JSON.parse(cleaned);
        return {
          title: `Predicted Jury Questions & Defense: ${req.projectTitle}`,
          content: 'Synthesized via Gemini API based on your project parameters.',
          questions: Array.isArray(questions) ? questions : [],
          modelUsed: this.modelName,
          tokens: execResult.tokens,
          durationMs: execResult.durationMs,
        };
      } catch (err) {
        throw new Error('Failed to parse jury viva questions from Gemini API.');
      }
    }

    // Text assets: Abstract, Concept Statement, Presentation Arc, Portfolio Description
    const typeDescriptions: Record<string, string> = {
      'abstract': 'a professional 250-word architectural abstract suitable for academic competitions and exhibition sheets',
      'concept-statement': 'a poetic, rigorous 3-point architectural concept statement articulating grounding, light, and tectonic memory',
      'presentation-outline': 'a step-by-step 10-minute presentation story arc broken into Minute 0-2 (Site & Context), Minute 2-5 (Core Concept), Minute 5-8 (Walkthrough Plans & Sections), Minute 8-10 (Tectonic Details & Defense)',
      'project-description': 'a compelling, publication-ready architectural project narrative with clear tectonic highlights'
    };

    const targetDescription = typeDescriptions[req.type] || 'an architectural portfolio narrative';

    const systemInstruction = `You are Archora Studio Presentation Coach and Architectural Editor.
Your task is to write ${targetDescription} for an architecture student.
Write in clear, sophisticated architectural prose with strong spatial and tectonic terminology.`;

    const prompt = `Project Title: ${req.projectTitle}
Key Details / Focus: ${req.keyDetails || 'Contemporary climate-responsive architectural design'}
Output Asset Type: ${req.type}

Generate the complete, publication-ready architectural copy formatted in GitHub markdown.`;

    const execResult = await this.executeWithTimeout(async () => {
      return await this.ai!.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });
    });

    return {
      title: `${req.projectTitle} — ${req.type.replace('-', ' ').toUpperCase()}`,
      content: execResult.text.trim(),
      modelUsed: this.modelName,
      tokens: execResult.tokens,
      durationMs: execResult.durationMs,
    };
  }
}

export const geminiService = new GeminiService();
