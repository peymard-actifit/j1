// Utilitaires pour le stockage - utilise maintenant l'API Vercel

import { User, UserDataField, CVFormat } from '../types/database';
import { api } from './api';

const STORAGE_KEYS = {
  USERS: 'j1_users',
  CV_FORMATS: 'j1_cv_formats',
  CURRENT_USER: 'j1_current_user',
};

export const storage = {
  // Users
  async getUsers(): Promise<User[]> {
    try {
      return await api.getUser('') || [];
    } catch {
      return [];
    }
  },

  async getUser(id: string): Promise<User | null> {
    try {
      return await api.getUser(id);
    } catch {
      return null;
    }
  },

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await api.getUserByEmail(email);
    } catch {
      return null;
    }
  },

  async saveUser(user: User): Promise<User> {
    try {
      // Vérifier si l'utilisateur existe
      const existing = await api.getUser(user.id);
      if (existing) {
        return await api.updateUser(user.id, user);
      } else {
        return await api.createUser(user);
      }
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  },

  // Current user session (toujours en localStorage pour la session)
  getCurrentUser: (): User | null => {
    const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!userId) return null;
    // On retourne null car on doit faire un appel async pour récupérer l'utilisateur
    // Cette fonction sera utilisée uniquement pour récupérer l'ID
    return null;
  },

  getCurrentUserId: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  },

  setCurrentUser: (user: User | null): void => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, user.id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  // CV Formats
  async getCVFormats(filters?: {
    country?: string;
    targetRecipient?: string;
    search?: string;
  }): Promise<CVFormat[]> {
    try {
      return await api.getCVFormats(filters) || [];
    } catch {
      return [];
    }
  },

  async getCVFormat(id: string): Promise<CVFormat | null> {
    try {
      return await api.getCVFormat(id);
    } catch {
      return null;
    }
  },

  async saveCVFormat(format: CVFormat): Promise<CVFormat> {
    try {
      const existing = await api.getCVFormat(format.id);
      if (existing) {
        return await api.updateCVFormat(format.id, format);
      } else {
        return await api.createCVFormat(format);
      }
    } catch (error) {
      console.error('Error saving CV format:', error);
      throw error;
    }
  },

  async deleteCVFormat(id: string): Promise<void> {
    try {
      await api.deleteCVFormat(id);
    } catch (error) {
      console.error('Error deleting CV format:', error);
      throw error;
    }
  },
};

// Initialisation de la structure de base de données par défaut
export const initializeDefaultStructure = (): UserDataField[] => {
  const now = new Date().toISOString();
  return [
    {
      id: 'name',
      name: 'Nom',
      tag: 'name',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'firstname',
      name: 'Prénom',
      tag: 'firstname',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'email',
      name: 'Email',
      tag: 'email',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'phone',
      name: 'Téléphone',
      tag: 'phone',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'address',
      name: 'Adresse',
      tag: 'address',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'birthdate',
      name: 'Date de naissance',
      tag: 'birthdate',
      type: 'date',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'summary',
      name: 'Résumé professionnel',
      tag: 'summary',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experience',
      name: 'Expériences',
      tag: 'experience',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'education',
      name: 'Formation',
      tag: 'education',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'skills',
      name: 'Compétences',
      tag: 'skills',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
};

