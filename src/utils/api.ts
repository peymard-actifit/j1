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
};
