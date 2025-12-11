// Client API pour communiquer avec les fonctions serverless Vercel

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const api = {
  // Users
  async getUser(id: string) {
    try {
      const res = await fetch(`${API_BASE}/users?id=${id}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  async getUserByEmail(email: string) {
    try {
      const res = await fetch(`${API_BASE}/users?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  },

  async createUser(user: any) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return res.json();
  },

  async updateUser(id: string, updates: any) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    return res.json();
  },

  // CV Formats
  async getCVFormats(filters?: {
    country?: string;
    targetRecipient?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.country) params.append('country', filters.country);
    if (filters?.targetRecipient) params.append('targetRecipient', filters.targetRecipient);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`${API_BASE}/cv-formats?${params.toString()}`);
    return res.json();
  },

  async getCVFormat(id: string) {
    const res = await fetch(`${API_BASE}/cv-formats?id=${id}`);
    const formats = await res.json();
    return Array.isArray(formats) ? formats[0] : formats;
  },

  async createCVFormat(format: any) {
    const res = await fetch(`${API_BASE}/cv-formats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(format),
    });
    return res.json();
  },

  async updateCVFormat(id: string, updates: any) {
    const res = await fetch(`${API_BASE}/cv-formats`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    return res.json();
  },

  async deleteCVFormat(id: string) {
    const res = await fetch(`${API_BASE}/cv-formats?id=${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // AI
  async analyzeCV(fileContent: string, fileName: string, fileType: string) {
    const res = await fetch(`${API_BASE}/ai/analyze-cv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileContent, fileName, fileType }),
    });
    return res.json();
  },

  async callAI(type: string, input: any, userId: string, userData?: any) {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, input, userId, userData }),
    });
    return res.json();
  },

  // Translation
  async translate(text: string, targetLang: string, sourceLang?: string) {
    const res = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang, sourceLang }),
    });
    return res.json();
  },

  async translateBatch(texts: string[], targetLang: string, sourceLang?: string) {
    const res = await fetch(`${API_BASE}/translate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, targetLang, sourceLang }),
    });
    return res.json();
  },
};

