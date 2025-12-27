import { User, CVFormat } from '../types/database';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Types pour les erreurs API unifiées
export interface APIError {
  code: string;
  message: string;
  details?: string;
  retryable: boolean;
  provider?: string;
}

// Types pour les métriques
export interface APIMetrics {
  duration?: number;
  tokensUsed?: number;
  charactersUsed?: number;
  retryCount?: number;
  model?: string;
}

// Helper pour les appels API avec gestion d'erreur unifiée
async function apiCall<T>(
  url: string, 
  options: RequestInit = {}
): Promise<{ data?: T; error?: APIError }> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    // Lire le texte brut d'abord
    const responseText = await response.text();
    
    // Essayer de parser en JSON
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // Si ce n'est pas du JSON, créer une erreur appropriée
      console.error('API returned non-JSON response:', responseText.substring(0, 200));
      return { 
        error: { 
          code: 'INVALID_RESPONSE', 
          message: `Le serveur a retourné une réponse invalide (${response.status})`, 
          details: responseText.substring(0, 100),
          retryable: response.status >= 500 
        } 
      };
    }
    
    if (!response.ok || data.error) {
      return { 
        data, 
        error: data.error || { 
          code: 'HTTP_ERROR', 
          message: `HTTP ${response.status}`, 
          retryable: response.status >= 500 
        } 
      };
    }
    
    return { data };
  } catch (error: any) {
    return { 
      error: { 
        code: 'NETWORK_ERROR', 
        message: error.message || 'Erreur réseau', 
        retryable: true 
      } 
    };
  }
}

export const api = {
  // =====================
  // USERS
  // =====================
  async getUser(id: string): Promise<User | null> {
    const { data } = await apiCall<User>(`/api/users/${id}`);
    return data || null;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const { data } = await apiCall<User>(`/api/users?email=${encodeURIComponent(email)}`);
    return data || null;
  },

  async createUser(user: User): Promise<User> {
    const { data, error } = await apiCall<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    if (error) throw new Error(error.message);
    return data!;
  },

  async updateUser(id: string, user: User): Promise<User> {
    const { data, error } = await apiCall<User>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
    if (error) throw new Error(error.message);
    return data!;
  },

  async deleteAllUsers(): Promise<void> {
    const { error } = await apiCall('/api/users', { method: 'DELETE' });
    if (error) throw new Error(error.message);
  },

  // =====================
  // CV FORMATS
  // =====================
  async getCVFormats(filters?: {
    country?: string;
    targetRecipient?: string;
    search?: string;
  }): Promise<CVFormat[]> {
    const params = new URLSearchParams();
    if (filters?.country) params.append('country', filters.country);
    if (filters?.targetRecipient) params.append('targetRecipient', filters.targetRecipient);
    if (filters?.search) params.append('search', filters.search);
    
    const { data } = await apiCall<CVFormat[]>(`/api/cv-formats?${params}`);
    return data || [];
  },

  async getCVFormat(id: string): Promise<CVFormat | null> {
    const { data } = await apiCall<CVFormat>(`/api/cv-formats/${id}`);
    return data || null;
  },

  async createCVFormat(format: CVFormat): Promise<CVFormat> {
    const { data, error } = await apiCall<CVFormat>('/api/cv-formats', {
      method: 'POST',
      body: JSON.stringify(format),
    });
    if (error) throw new Error(error.message);
    return data!;
  },

  async updateCVFormat(id: string, format: CVFormat): Promise<CVFormat> {
    const { data, error } = await apiCall<CVFormat>(`/api/cv-formats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(format),
    });
    if (error) throw new Error(error.message);
    return data!;
  },

  async deleteCVFormat(id: string): Promise<void> {
    const { error } = await apiCall(`/api/cv-formats/${id}`, { method: 'DELETE' });
    if (error) throw new Error(error.message);
  },

  // =====================
  // TRANSLATION (DeepL optimisé)
  // =====================
  
  // Traduction simple (une seule chaîne) - pour compatibilité avec l'existant
  async translate(
    text: string, 
    targetLang: string, 
    sourceLang?: string,
    options?: {
      formality?: 'default' | 'more' | 'less' | 'prefer_more' | 'prefer_less';
      preserveFormatting?: boolean;
      context?: string;
    }
  ): Promise<{ 
    success: boolean; 
    text: string; 
    detectedLang?: string;
    metrics?: APIMetrics;
    error?: APIError;
  }> {
    const { data, error } = await apiCall<{
      success: boolean;
      translatedText: string | string[];
      detectedSourceLang?: string;
      metrics?: APIMetrics;
      error?: APIError;
    }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ 
        text, 
        targetLang, 
        sourceLang,
        ...options 
      }),
    });
    
    if (error || !data?.success) {
      return { 
        success: false, 
        text: text,
        error: error || data?.error 
      };
    }
    
    // Toujours retourner une chaîne pour la traduction simple
    const translatedText = Array.isArray(data.translatedText) 
      ? data.translatedText[0] || text 
      : data.translatedText;
    
    return { 
      success: true, 
      text: translatedText,
      detectedLang: data.detectedSourceLang,
      metrics: data.metrics
    };
  },

  // Traduction batch optimisée (plusieurs chaînes en une seule requête)
  async translateBatch(
    texts: string[],
    targetLang: string,
    sourceLang?: string,
    options?: {
      formality?: 'default' | 'more' | 'less' | 'prefer_more' | 'prefer_less';
      preserveFormatting?: boolean;
      context?: string;
    }
  ): Promise<{ 
    success: boolean; 
    texts: string[]; 
    detectedLang?: string;
    metrics?: APIMetrics;
    error?: APIError;
  }> {
    const { data, error } = await apiCall<{
      success: boolean;
      translatedText: string | string[];
      detectedSourceLang?: string;
      metrics?: APIMetrics;
      error?: APIError;
    }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ 
        text: texts, 
        targetLang, 
        sourceLang,
        ...options 
      }),
    });
    
    if (error || !data?.success) {
      return { 
        success: false, 
        texts: texts,
        error: error || data?.error 
      };
    }
    
    const translatedTexts = Array.isArray(data.translatedText) 
      ? data.translatedText 
      : [data.translatedText];
    
    return {
      success: true,
      texts: translatedTexts,
      detectedLang: data.detectedSourceLang,
      metrics: data.metrics
    };
  },

  // =====================
  // PDF EXTRACTION (OpenAI Vision)
  // =====================
  async extractPdfText(params: {
    fileContent?: string;
    imageBase64?: string;
    existingText?: string;
    extractionMode?: 'ocr' | 'enhance' | 'full';
  }): Promise<{ 
    success: boolean; 
    text: string;
    confidence?: number;
    method?: string;
    metrics?: APIMetrics;
    error?: APIError;
  }> {
    const { data, error } = await apiCall<{
      success: boolean;
      text: string;
      confidence?: number;
      method?: string;
      metrics?: APIMetrics;
      error?: APIError;
    }>('/api/extract-pdf-text', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    return {
      success: data?.success || false,
      text: data?.text || '',
      confidence: data?.confidence,
      method: data?.method,
      metrics: data?.metrics,
      error: error || data?.error
    };
  },

  // =====================
  // AI REPHRASE (OpenAI optimisé)
  // =====================
  async rephraseWithAI(params: {
    text: string;
    language: string;
    fieldName?: string;
    context?: boolean;
    style?: 'professional' | 'concise' | 'impactful' | 'detailed' | 'creative';
    preserveKeywords?: string[];
    maxLength?: number;
  }): Promise<{
    success: boolean;
    rephrasedText: string;
    originalText?: string;
    style?: string;
    metrics?: APIMetrics;
    error?: APIError;
  }> {
    const { data, error } = await apiCall<{
      success: boolean;
      rephrasedText: string;
      originalText?: string;
      style?: string;
      metrics?: APIMetrics;
      error?: APIError;
    }>('/api/rephrase', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    return {
      success: data?.success || false,
      rephrasedText: data?.rephrasedText || params.text,
      originalText: data?.originalText,
      style: data?.style,
      metrics: data?.metrics,
      error: error || data?.error
    };
  },

  // =====================
  // CV ANALYSIS (OpenAI optimisé)
  // =====================
  async analyzeCVWithAI(params: {
    textContent?: string;
    imageBase64?: string;
    existingFields: Array<{ id: string; name: string; tag: string; type: string }>;
    workingLanguage?: string;
    extractImages?: boolean;
    analysisDepth?: 'quick' | 'full' | 'deep';
  }): Promise<{
    success: boolean;
    extractedData: Array<{
      tag: string;
      name: string;
      value: string;
      confidence: number;
      isNew: boolean;
      suggestedType?: string;
      category?: string;
    }>;
    images: Array<{
      description: string;
      type: 'photo' | 'logo' | 'chart' | 'timeline' | 'icon' | 'other';
      suggestedTag?: string;
      location?: string;
    }>;
    summary?: string;
    suggestions?: string[];
    rawTextQuality?: string;
    detectedLanguage?: string;
    metrics?: APIMetrics;
    error?: APIError;
  }> {
    const { data, error } = await apiCall<any>('/api/analyze-cv', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    return {
      success: data?.success || false,
      extractedData: data?.extractedData || [],
      images: data?.images || [],
      summary: data?.summary,
      suggestions: data?.suggestions,
      rawTextQuality: data?.rawTextQuality,
      detectedLanguage: data?.detectedLanguage,
      metrics: data?.metrics,
      error: error || data?.error
    };
  },

  // =====================
  // CV PARSING AFFINDA (optimisé)
  // =====================
  async parseCVWithAffinda(params: {
    fileBase64?: string;
    fileName?: string;
    fileUrl?: string;
    textContent?: string;
  }): Promise<{
    success: boolean;
    extractedData: Array<{
      tag: string;
      name: string;
      value: string;
      confidence: number;
      isNew: boolean;
      suggestedType: string;
      source: string;
      category?: string;
    }>;
    rawData?: any;
    summary?: string;
    isResumeProbability?: number;
    metrics?: APIMetrics;
    error?: APIError;
  }> {
    const { data, error } = await apiCall<any>('/api/parse-cv-affinda', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    return {
      success: data?.success || false,
      extractedData: data?.extractedData || [],
      rawData: data?.rawData,
      summary: data?.summary,
      isResumeProbability: data?.isResumeProbability,
      metrics: data?.metrics,
      error: error || data?.error
    };
  },

  // =====================
  // COMBINED CV ANALYSIS (Affinda + OpenAI)
  // =====================
  async analyzeCVCombined(params: {
    fileBase64?: string;
    fileName?: string;
    textContent?: string;
    imageBase64?: string;
    existingFields: Array<{ id: string; name: string; tag: string; type: string }>;
    workingLanguage?: string;
    useAffinda?: boolean;
    useOpenAI?: boolean;
    analysisDepth?: 'quick' | 'full' | 'deep';
  }): Promise<{
    success: boolean;
    extractedData: Array<{
      tag: string;
      name: string;
      value: string;
      confidence: number;
      isNew: boolean;
      suggestedType?: string;
      source?: string;
      category?: string;
    }>;
    images: Array<{
      description: string;
      type: 'photo' | 'logo' | 'chart' | 'timeline' | 'icon' | 'other';
      suggestedTag?: string;
    }>;
    summary?: string;
    suggestions?: string[];
    error?: APIError;
    affindaUsed?: boolean;
    openaiUsed?: boolean;
    metrics?: {
      affinda?: APIMetrics;
      openai?: APIMetrics;
      total?: APIMetrics;
    };
  }> {
    const results: Array<{
      tag: string;
      name: string;
      value: string;
      confidence: number;
      isNew: boolean;
      suggestedType?: string;
      source?: string;
      category?: string;
    }> = [];
    const images: Array<{
      description: string;
      type: 'photo' | 'logo' | 'chart' | 'timeline' | 'icon' | 'other';
      suggestedTag?: string;
    }> = [];
    let summary = '';
    const suggestions: string[] = [];
    let affindaUsed = false;
    let openaiUsed = false;
    const errors: string[] = [];
    const metrics: { affinda?: APIMetrics; openai?: APIMetrics } = {};

    const startTime = Date.now();

    // 1. Affinda pour parsing structuré (si fichier disponible)
    if (params.useAffinda !== false && params.fileBase64) {
      try {
        const affindaResult = await this.parseCVWithAffinda({
          fileBase64: params.fileBase64,
          fileName: params.fileName,
          textContent: params.textContent
        });

        if (affindaResult.success && affindaResult.extractedData.length > 0) {
          affindaUsed = true;
          metrics.affinda = affindaResult.metrics;
          
          affindaResult.extractedData.forEach(item => {
            results.push({ ...item, source: 'affinda' });
          });
          
          if (affindaResult.summary) {
            summary = affindaResult.summary;
          }
        } else if (affindaResult.error) {
          errors.push(`Affinda: ${affindaResult.error.message}`);
        }
      } catch (e: any) {
        errors.push(`Affinda: ${e.message}`);
      }
    }

    // 2. OpenAI pour analyse enrichie et visuelle
    if (params.useOpenAI !== false && (params.textContent || params.imageBase64)) {
      try {
        const openaiResult = await this.analyzeCVWithAI({
          textContent: params.textContent,
          imageBase64: params.imageBase64,
          existingFields: params.existingFields,
          workingLanguage: params.workingLanguage,
          extractImages: true,
          analysisDepth: params.analysisDepth
        });

        if (openaiResult.success) {
          openaiUsed = true;
          metrics.openai = openaiResult.metrics;
          
          // Fusionner avec les résultats Affinda
          openaiResult.extractedData.forEach(item => {
            const existingIndex = results.findIndex(
              r => r.tag.toLowerCase() === item.tag.toLowerCase()
            );
            
            if (existingIndex === -1) {
              // Nouveau champ de OpenAI
              results.push({ ...item, source: 'openai' });
            } else if (item.confidence > (results[existingIndex].confidence || 0)) {
              // OpenAI a meilleure confiance, mise à jour
              results[existingIndex] = {
                ...results[existingIndex],
                value: item.value,
                confidence: item.confidence,
                source: 'openai+affinda'
              };
            }
          });

          // Ajouter les images
          if (openaiResult.images) {
            images.push(...openaiResult.images);
          }

          // Enrichir le résumé
          if (openaiResult.summary) {
            summary = summary 
              ? `${summary}\n\n📊 Analyse IA: ${openaiResult.summary}`
              : openaiResult.summary;
          }

          // Ajouter les suggestions
          if (openaiResult.suggestions) {
            suggestions.push(...openaiResult.suggestions);
          }
        } else if (openaiResult.error) {
          errors.push(`OpenAI: ${openaiResult.error.message}`);
        }
      } catch (e: any) {
        errors.push(`OpenAI: ${e.message}`);
      }
    }

    const success = results.length > 0;
    const totalDuration = Date.now() - startTime;
    
    return {
      success,
      extractedData: results,
      images,
      summary: summary || (success ? `${results.length} champs extraits` : 'Aucune donnée extraite'),
      suggestions,
      error: errors.length > 0 ? { 
        code: 'PARTIAL_ERROR', 
        message: errors.join('; '), 
        retryable: true 
      } : undefined,
      affindaUsed,
      openaiUsed,
      metrics: {
        ...metrics,
        total: { duration: totalDuration }
      }
    };
  },

  // =====================
  // UTILITY: Format error for display
  // =====================
  formatError(error: APIError | undefined): string {
    if (!error) return 'Erreur inconnue';
    
    const providerText = error.provider ? ` (${error.provider})` : '';
    const retryText = error.retryable ? ' - Réessayez' : '';
    
    return `${error.message}${providerText}${retryText}`;
  },

  // =====================
  // UTILITY: Format metrics for display
  // =====================
  formatMetrics(metrics: APIMetrics | undefined): string {
    if (!metrics) return '';
    
    const parts: string[] = [];
    if (metrics.duration) parts.push(`${metrics.duration}ms`);
    if (metrics.tokensUsed) parts.push(`${metrics.tokensUsed} tokens`);
    if (metrics.charactersUsed) parts.push(`${metrics.charactersUsed} car.`);
    if (metrics.model) parts.push(metrics.model);
    
    return parts.join(' | ');
  }
};
