// Types pour la structure de base de données utilisateur

export interface LanguageVersion {
  language: string;
  version: number; // 1, 2 ou 3 - trois versions par langue
  value: string;
  createdAt: string;
  prompt?: string;
}

export interface AIVersion {
  version: number; // 1, 2 ou 3
  value: string;
  createdAt: string;
  prompt?: string;
}

export interface UserDataField {
  id: string;
  name: string;
  tag: string;
  type: 'text' | 'number' | 'image' | 'video' | 'date' | 'url';
  baseLanguage: string;
  languageVersions: LanguageVersion[];
  aiVersions: AIVersion[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface User {
  id: string;
  email: string;
  password: string; // hashé
  name: string;
  baseLanguage: string;
  isAdmin: boolean;
  adminCode?: string;
  data: UserDataField[];
  createdAt: string;
  updatedAt: string;
}

export interface CVFormat {
  id: string;
  name: string;
  description?: string;
  metadata: {
    country?: string[];
    targetRecipients?: string[]; // 'esn', 'entreprise', etc.
    tags?: string[];
  };
  structure: CVFormatField[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // admin user id
}

export interface CVFormatField {
  id: string;
  tag: string;
  label: string;
  type: 'text' | 'section' | 'list' | 'date';
  required: boolean;
  mapping?: string; // tag de données utilisateur par défaut
}

export interface CVGeneration {
  id: string;
  userId: string;
  formatId: string;
  fieldMappings: Record<string, string>; // formatFieldId -> userDataFieldId
  generatedAt: string;
  pdfUrl?: string;
}








