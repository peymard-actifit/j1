// Utilitaires pour le stockage local (sera remplacé par une vraie BDD plus tard)

import { User, UserDataField, CVFormat } from '../types/database';

const STORAGE_KEYS = {
  USERS: 'j1_users',
  CV_FORMATS: 'j1_cv_formats',
  CURRENT_USER: 'j1_current_user',
};

export const storage = {
  // Users
  getUsers: (): User[] => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },

  saveUsers: (users: User[]): void => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  getUser: (id: string): User | null => {
    const users = storage.getUsers();
    return users.find(u => u.id === id) || null;
  },

  getUserByEmail: (email: string): User | null => {
    const users = storage.getUsers();
    return users.find(u => u.email === email) || null;
  },

  saveUser: (user: User): void => {
    const users = storage.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    storage.saveUsers(users);
  },

  // Current user session
  getCurrentUser: (): User | null => {
    const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!userId) return null;
    return storage.getUser(userId);
  },

  setCurrentUser: (user: User | null): void => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, user.id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  // CV Formats
  getCVFormats: (): CVFormat[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CV_FORMATS);
    return data ? JSON.parse(data) : [];
  },

  saveCVFormats: (formats: CVFormat[]): void => {
    localStorage.setItem(STORAGE_KEYS.CV_FORMATS, JSON.stringify(formats));
  },

  getCVFormat: (id: string): CVFormat | null => {
    const formats = storage.getCVFormats();
    return formats.find(f => f.id === id) || null;
  },

  saveCVFormat: (format: CVFormat): void => {
    const formats = storage.getCVFormats();
    const index = formats.findIndex(f => f.id === format.id);
    if (index >= 0) {
      formats[index] = format;
    } else {
      formats.push(format);
    }
    storage.saveCVFormats(formats);
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

