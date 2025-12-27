import { User, CVFormat } from '../types/database';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export const api = {
  // Users
  async getUser(id: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/api/users/${id}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/api/users?email=${encodeURIComponent(email)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  async createUser(user: User): Promise<User> {
    const response = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error('Failed to create user');
    return await response.json();
  },

  async updateUser(id: string, user: User): Promise<User> {
    const response = await fetch(`${API_BASE}/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) throw new Error('Failed to update user');
    return await response.json();
  },

  async deleteAllUsers(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/users`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete users');
  },

  // CV Formats
  async getCVFormats(filters?: {
    country?: string;
    targetRecipient?: string;
    search?: string;
  }): Promise<CVFormat[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.country) params.append('country', filters.country);
      if (filters?.targetRecipient) params.append('targetRecipient', filters.targetRecipient);
      if (filters?.search) params.append('search', filters.search);
      
      const response = await fetch(`${API_BASE}/api/cv-formats?${params}`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  },

  async getCVFormat(id: string): Promise<CVFormat | null> {
    try {
      const response = await fetch(`${API_BASE}/api/cv-formats/${id}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  async createCVFormat(format: CVFormat): Promise<CVFormat> {
    const response = await fetch(`${API_BASE}/api/cv-formats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(format),
    });
    if (!response.ok) throw new Error('Failed to create CV format');
    return await response.json();
  },

  async updateCVFormat(id: string, format: CVFormat): Promise<CVFormat> {
    const response = await fetch(`${API_BASE}/api/cv-formats/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(format),
    });
    if (!response.ok) throw new Error('Failed to update CV format');
    return await response.json();
  },

  async deleteCVFormat(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/cv-formats/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete CV format');
  },

  // Translation
  async translate(text: string, targetLang: string, sourceLang: string): Promise<{ success: boolean; text: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang, sourceLang }),
      });
      if (!response.ok) {
        return { success: false, text: text };
      }
      const result = await response.json();
      return { success: true, text: result.translatedText || text };
    } catch {
      return { success: false, text: text };
    }
  },

  // PDF extraction
  async extractPdfText(fileContent: string): Promise<{ success: boolean; text: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/extract-pdf-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent }),
      });
      if (!response.ok) {
        return { success: false, text: '' };
      }
      const result = await response.json();
      return { success: true, text: result.text || '' };
    } catch {
      return { success: false, text: '' };
    }
  },

  // AI Rephrase (reformulation)
  async rephraseWithAI(params: {
    text: string;
    language: string;
    fieldName?: string;
    context?: boolean;
  }): Promise<{
    success: boolean;
    rephrasedText: string;
    error?: string;
    tokensUsed?: number;
  }> {
    try {
      const response = await fetch(`${API_BASE}/api/rephrase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          rephrasedText: params.text,
          error: result.error || 'Erreur lors de la reformulation'
        };
      }
      
      return {
        success: result.success,
        rephrasedText: result.rephrasedText || params.text,
        error: result.error,
        tokensUsed: result.tokensUsed
      };
    } catch (error: any) {
      return {
        success: false,
        rephrasedText: params.text,
        error: error.message || 'Erreur de connexion'
      };
    }
  },

  // CV Analysis with AI (OpenAI)
  async analyzeCVWithAI(params: {
    textContent?: string;
    imageBase64?: string;
    existingFields: Array<{ id: string; name: string; tag: string; type: string }>;
    workingLanguage?: string;
    extractImages?: boolean;
  }): Promise<{
    success: boolean;
    extractedData: Array<{
      tag: string;
      name: string;
      value: string;
      confidence: number;
      isNew: boolean;
      suggestedType?: string;
    }>;
    images: Array<{
      description: string;
      type: 'photo' | 'logo' | 'chart' | 'timeline' | 'icon' | 'other';
      suggestedTag?: string;
      base64?: string;
    }>;
    summary?: string;
    suggestions?: string[];
    error?: string;
    tokensUsed?: number;
  }> {
    try {
      const response = await fetch(`${API_BASE}/api/analyze-cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          extractedData: [],
          images: [],
          error: result.error || 'Erreur lors de l\'analyse'
        };
      }
      
      return {
        success: result.success,
        extractedData: result.extractedData || [],
        images: result.images || [],
        summary: result.summary,
        suggestions: result.suggestions,
        error: result.error,
        tokensUsed: result.tokensUsed
      };
    } catch (error: any) {
      return {
        success: false,
        extractedData: [],
        images: [],
        error: error.message || 'Erreur de connexion'
      };
    }
  },

  // CV Parsing with Affinda (Professional Resume Parser)
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
    }>;
    rawData?: any;
    summary?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE}/api/parse-cv-affinda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          extractedData: [],
          error: result.error || 'Erreur lors du parsing Affinda'
        };
      }
      
      return {
        success: result.success,
        extractedData: result.extractedData || [],
        rawData: result.rawData,
        summary: result.summary,
        error: result.error
      };
    } catch (error: any) {
      return {
        success: false,
        extractedData: [],
        error: error.message || 'Erreur de connexion à Affinda'
      };
    }
  },

  // Combined CV Analysis: Affinda + OpenAI for best results
  async analyzeCVCombined(params: {
    fileBase64?: string;
    fileName?: string;
    textContent?: string;
    imageBase64?: string;
    existingFields: Array<{ id: string; name: string; tag: string; type: string }>;
    workingLanguage?: string;
    useAffinda?: boolean;
    useOpenAI?: boolean;
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
    }>;
    images: Array<{
      description: string;
      type: 'photo' | 'logo' | 'chart' | 'timeline' | 'icon' | 'other';
      suggestedTag?: string;
      base64?: string;
    }>;
    summary?: string;
    suggestions?: string[];
    error?: string;
    affindaUsed?: boolean;
    openaiUsed?: boolean;
  }> {
    const results: Array<{
      tag: string;
      name: string;
      value: string;
      confidence: number;
      isNew: boolean;
      suggestedType?: string;
      source?: string;
    }> = [];
    const images: Array<{
      description: string;
      type: 'photo' | 'logo' | 'chart' | 'timeline' | 'icon' | 'other';
      suggestedTag?: string;
      base64?: string;
    }> = [];
    let summary = '';
    const suggestions: string[] = [];
    let affindaUsed = false;
    let openaiUsed = false;
    const errors: string[] = [];

    // 1. Try Affinda first (more accurate for structured data)
    if (params.useAffinda !== false && params.fileBase64) {
      try {
        const affindaResult = await this.parseCVWithAffinda({
          fileBase64: params.fileBase64,
          fileName: params.fileName,
          textContent: params.textContent
        });

        if (affindaResult.success && affindaResult.extractedData.length > 0) {
          affindaUsed = true;
          affindaResult.extractedData.forEach(item => {
            results.push({
              ...item,
              source: 'affinda'
            });
          });
          if (affindaResult.summary) {
            summary = affindaResult.summary;
          }
        } else if (affindaResult.error) {
          errors.push(`Affinda: ${affindaResult.error}`);
        }
      } catch (e: any) {
        errors.push(`Affinda error: ${e.message}`);
      }
    }

    // 2. Also use OpenAI for additional insights and image analysis
    if (params.useOpenAI !== false && (params.textContent || params.imageBase64)) {
      try {
        const openaiResult = await this.analyzeCVWithAI({
          textContent: params.textContent,
          imageBase64: params.imageBase64,
          existingFields: params.existingFields,
          workingLanguage: params.workingLanguage,
          extractImages: true
        });

        if (openaiResult.success) {
          openaiUsed = true;
          
          // Add OpenAI results, avoiding duplicates from Affinda
          openaiResult.extractedData.forEach(item => {
            const existingIndex = results.findIndex(
              r => r.tag.toLowerCase() === item.tag.toLowerCase()
            );
            
            if (existingIndex === -1) {
              // New field from OpenAI
              results.push({
                ...item,
                source: 'openai'
              });
            } else if (item.confidence > (results[existingIndex].confidence || 0)) {
              // OpenAI has higher confidence, update value
              results[existingIndex] = {
                ...results[existingIndex],
                value: item.value,
                confidence: item.confidence,
                source: 'openai+affinda'
              };
            }
          });

          // Add images from OpenAI
          if (openaiResult.images) {
            images.push(...openaiResult.images);
          }

          // Combine summaries
          if (openaiResult.summary) {
            summary = summary 
              ? `${summary}\n\n📊 Analyse IA: ${openaiResult.summary}`
              : openaiResult.summary;
          }

          // Add suggestions
          if (openaiResult.suggestions) {
            suggestions.push(...openaiResult.suggestions);
          }
        } else if (openaiResult.error) {
          errors.push(`OpenAI: ${openaiResult.error}`);
        }
      } catch (e: any) {
        errors.push(`OpenAI error: ${e.message}`);
      }
    }

    const success = results.length > 0;
    
    return {
      success,
      extractedData: results,
      images,
      summary: summary || (success ? `${results.length} champs extraits` : 'Aucune donnée extraite'),
      suggestions,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      affindaUsed,
      openaiUsed
    };
  },
};
