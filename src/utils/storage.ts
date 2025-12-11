// Utilitaires pour le stockage - utilise maintenant l'API Vercel

import { User, UserDataField, CVFormat } from '../types/database';
import { api } from './api';

const STORAGE_KEYS = {
  CURRENT_USER: 'j1_current_user',
};

export const storage = {
  // Users
  async getUsers(): Promise<User[]> {
    try {
      // Pour récupérer tous les utilisateurs, on peut faire une requête sans ID
      // Mais pour l'instant, on retourne un tableau vide car l'API ne supporte pas encore cette fonctionnalité
      return [];
    } catch {
      return [];
    }
  },

  async getUser(id: string): Promise<User | null> {
    try {
      const user = await api.getUser(id);
      return user || null;
    } catch {
      return null;
    }
  },

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await api.getUserByEmail(email);
      return user || null;
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
// Basée sur le template CV Long JustOne
export const initializeDefaultStructure = (): UserDataField[] => {
  const now = new Date().toISOString();
  return [
    // Informations personnelles
    {
      id: 'photo',
      name: 'Photo',
      tag: 'photo',
      type: 'image',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
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
      id: 'nationality',
      name: 'Nationalité',
      tag: 'nationality',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      tag: 'linkedin',
      type: 'url',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'website',
      name: 'Site web / Portfolio',
      tag: 'website',
      type: 'url',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Profil / Résumé
    {
      id: 'summary',
      name: 'Résumé professionnel / Profil',
      tag: 'summary',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'objective',
      name: 'Objectif professionnel',
      tag: 'objective',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Expériences professionnelles
    {
      id: 'experience',
      name: 'Expériences professionnelles',
      tag: 'experience',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'current_position',
      name: 'Poste actuel',
      tag: 'current_position',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Formations
    {
      id: 'education',
      name: 'Formations',
      tag: 'education',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'degrees',
      name: 'Diplômes',
      tag: 'degrees',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Compétences
    {
      id: 'skills',
      name: 'Compétences techniques',
      tag: 'skills',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'soft_skills',
      name: 'Compétences comportementales / Soft skills',
      tag: 'soft_skills',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'technical_skills',
      name: 'Compétences techniques détaillées',
      tag: 'technical_skills',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tools',
      name: 'Outils et technologies',
      tag: 'tools',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Langues
    {
      id: 'languages',
      name: 'Langues',
      tag: 'languages',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Certifications
    {
      id: 'certifications',
      name: 'Certifications',
      tag: 'certifications',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Projets
    {
      id: 'projects',
      name: 'Projets',
      tag: 'projects',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Publications
    {
      id: 'publications',
      name: 'Publications',
      tag: 'publications',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Références
    {
      id: 'references',
      name: 'Références',
      tag: 'references',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Centres d'intérêt
    {
      id: 'interests',
      name: 'Centres d\'intérêt',
      tag: 'interests',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Informations complémentaires
    {
      id: 'additional_info',
      name: 'Informations complémentaires',
      tag: 'additional_info',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'availability',
      name: 'Disponibilité',
      tag: 'availability',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mobility',
      name: 'Mobilité',
      tag: 'mobility',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
};
