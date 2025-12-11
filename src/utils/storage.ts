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

  async deleteAllUsers(): Promise<void> {
    try {
      await api.deleteAllUsers();
    } catch (error) {
      console.error('Error deleting all users:', error);
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
// Basée sur le template CV Long JustOne (20251118 JUSTONE Template CV Long.pdf)
export const initializeDefaultStructure = (): UserDataField[] => {
  const now = new Date().toISOString();
  return [
    // Informations personnelles - En-tête
    {
      id: 'prenom',
      name: 'Prénom',
      tag: 'PRENOM',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'nom',
      name: 'Nom',
      tag: 'NOM',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'adresse01',
      name: 'Adresse ligne 1',
      tag: 'adresse01',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'adresse02',
      name: 'Adresse ligne 2',
      tag: 'adresse02',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'codepostal',
      name: 'Code postal',
      tag: 'CodePostal',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ville',
      name: 'Ville',
      tag: 'Ville',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'pays',
      name: 'Pays',
      tag: 'Pays',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'region',
      name: 'Région',
      tag: 'Region',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'telephone',
      name: 'Téléphone',
      tag: 'Telephone',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mail',
      name: 'Email',
      tag: 'Mail',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'datedenaissance',
      name: 'Date de naissance',
      tag: 'DateDeNaissance',
      type: 'date',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lieudenaissance',
      name: 'Lieu de naissance',
      tag: 'LieuDeNaissance',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'langue01',
      name: 'Langue principale',
      tag: 'Langue01',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'niveaulangue01',
      name: 'Niveau langue principale',
      tag: 'NiveauLangue01',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mobilite',
      name: 'Mobilité',
      tag: 'Mobilite',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'moisducv',
      name: 'Mois du CV',
      tag: 'MoisDuCV',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'anneeducv',
      name: 'Année du CV',
      tag: 'AnneeDuCV',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Poste recherché
    {
      id: 'posterecherche',
      name: 'Poste recherché',
      tag: 'POSTERECHERCHE',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'autresintitulesduposte',
      name: 'Autres intitulés du poste',
      tag: 'AUTRESINTITULESDUPOSTE',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Résumé général
    {
      id: 'resumegeneral',
      name: 'Résumé général',
      tag: 'resumegeneral',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Compétences clés (1 à 8)
    {
      id: 'competenceclef01',
      name: 'Compétence clé 1',
      tag: 'CompetenceClef01',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competenceclef02',
      name: 'Compétence clé 2',
      tag: 'CompetenceClef02',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competenceclef03',
      name: 'Compétence clé 3',
      tag: 'CompetenceClef03',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competenceclef04',
      name: 'Compétence clé 4',
      tag: 'CompetenceClef04',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competenceclef05',
      name: 'Compétence clé 5',
      tag: 'CompetenceClef05',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competenceclef06',
      name: 'Compétence clé 6',
      tag: 'CompetenceClef06',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competenceclef07',
      name: 'Compétence clé 7',
      tag: 'CompetenceClef07',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'competenceclef08',
      name: 'Compétence clé 8',
      tag: 'CompetenceClef08',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Expériences significatives (1 à 10)
    {
      id: 'experiencesignificative01',
      name: 'Expérience significative 1',
      tag: 'ExperienceSignificative01',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative02',
      name: 'Expérience significative 2',
      tag: 'ExperienceSignificative02',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative03',
      name: 'Expérience significative 3',
      tag: 'ExperienceSignificative03',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative04',
      name: 'Expérience significative 4',
      tag: 'ExperienceSignificative04',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative05',
      name: 'Expérience significative 5',
      tag: 'ExperienceSignificative05',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative06',
      name: 'Expérience significative 6',
      tag: 'ExperienceSignificative06',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative07',
      name: 'Expérience significative 7',
      tag: 'ExperienceSignificative07',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative08',
      name: 'Expérience significative 8',
      tag: 'ExperienceSignificative08',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative09',
      name: 'Expérience significative 9',
      tag: 'ExperienceSignificative09',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'experiencesignificative10',
      name: 'Expérience significative 10',
      tag: 'ExperienceSignificative10',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Secteurs d'activité (1 à 8)
    {
      id: 'secteuractivite01',
      name: 'Secteur d\'activité 1',
      tag: 'SecteurActivite01',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'secteuractivite02',
      name: 'Secteur d\'activité 2',
      tag: 'SecteurActivite02',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'secteuractivite03',
      name: 'Secteur d\'activité 3',
      tag: 'SecteurActivite03',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'secteuractivite04',
      name: 'Secteur d\'activité 4',
      tag: 'SecteurActivite04',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'secteuractivite05',
      name: 'Secteur d\'activité 5',
      tag: 'SecteurActivite05',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'secteuractivite06',
      name: 'Secteur d\'activité 6',
      tag: 'SecteurActivite06',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'secteuractivite07',
      name: 'Secteur d\'activité 7',
      tag: 'SecteurActivite07',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'secteuractivite08',
      name: 'Secteur d\'activité 8',
      tag: 'SecteurActivite08',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Formations initiales (1 à 4)
    {
      id: 'formationinitiale01',
      name: 'Formation initiale 1',
      tag: 'FormationInitiale01',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'formationinitiale02',
      name: 'Formation initiale 2',
      tag: 'FormationInitiale02',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'formationinitiale03',
      name: 'Formation initiale 3',
      tag: 'FormationInitiale03',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'formationinitiale04',
      name: 'Formation initiale 4',
      tag: 'FormationInitiale04',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // Expériences professionnelles détaillées (XP01 à XP10)
    // XP01
    {
      id: 'xp01periode',
      name: 'XP01 - Période',
      tag: 'XP01Periode',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01duree',
      name: 'XP01 - Durée',
      tag: 'XP01Duree',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01entreprise',
      name: 'XP01 - Entreprise',
      tag: 'XP01ENTREPRISE',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01secteurentreprise',
      name: 'XP01 - Secteur entreprise',
      tag: 'XP01SecteurEntreprise',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01posteabrege',
      name: 'XP01 - Poste abrégé',
      tag: 'XP01PosteAbrege',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01budget',
      name: 'XP01 - Budget',
      tag: 'XP01Budget',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01tailleequipe',
      name: 'XP01 - Taille équipe',
      tag: 'XP01TailleEquipe',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01erpcrm',
      name: 'XP01 - ERP/CRM',
      tag: 'XP01ERPCRM',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01poste',
      name: 'XP01 - Poste',
      tag: 'XP01POSTE',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01statut',
      name: 'XP01 - Statut',
      tag: 'XP01STATUT',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01contexte',
      name: 'XP01 - Contexte',
      tag: 'XP01Contexte',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01mission',
      name: 'XP01 - Mission',
      tag: 'XP01Mission',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'xp01resultats',
      name: 'XP01 - Résultats',
      tag: 'XP01Resultats',
      type: 'text',
      baseLanguage: 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: now,
      updatedAt: now,
    },
    // XP02 à XP10 - Création des champs pour chaque expérience
    ...Array.from({ length: 9 }, (_, i) => {
      const num = String(i + 2).padStart(2, '0');
      return [
        {
          id: `xp${num}periode`,
          name: `XP${num} - Période`,
          tag: `XP${num}Periode`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}duree`,
          name: `XP${num} - Durée`,
          tag: `XP${num}Duree`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}entreprise`,
          name: `XP${num} - Entreprise`,
          tag: `XP${num}ENTREPRISE`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}secteurentreprise`,
          name: `XP${num} - Secteur entreprise`,
          tag: `XP${num}SecteurEntreprise`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}posteabrege`,
          name: `XP${num} - Poste abrégé`,
          tag: `XP${num}PosteAbrege`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}budget`,
          name: `XP${num} - Budget`,
          tag: `XP${num}Budget`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}tailleequipe`,
          name: `XP${num} - Taille équipe`,
          tag: `XP${num}TailleEquipe`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}erpcrm`,
          name: `XP${num} - ERP/CRM`,
          tag: `XP${num}ERPCRM`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}poste`,
          name: `XP${num} - Poste`,
          tag: `XP${num}POSTE`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}statut`,
          name: `XP${num} - Statut`,
          tag: `XP${num}STATUT`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}contexte`,
          name: `XP${num} - Contexte`,
          tag: `XP${num}Contexte`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}mission`,
          name: `XP${num} - Mission`,
          tag: `XP${num}Mission`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `xp${num}resultats`,
          name: `XP${num} - Résultats`,
          tag: `XP${num}Resultats`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
      ];
    }).flat(),
    // Expériences associatives (1 à 5)
    ...Array.from({ length: 5 }, (_, i): UserDataField[] => {
      const num = String(i + 1).padStart(2, '0');
      return [
        {
          id: `dureeexperienceassociative${num}`,
          name: `Durée expérience associative ${num}`,
          tag: `DureeExperienceAssociative${num}`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `experienceassociative${num}`,
          name: `Expérience associative ${num}`,
          tag: `ExperienceAssociative${num}`,
          type: 'text' as const,
          baseLanguage: 'fr',
          languageVersions: [],
          aiVersions: [],
          createdAt: now,
          updatedAt: now,
        },
      ];
    }).flat(),
    // Publications (1 à 5)
    ...Array.from({ length: 5 }, (_, i): UserDataField => {
      const num = i + 1;
      return {
        id: `publication${num}`,
        name: `Publication ${num}`,
        tag: `Publication${num}`,
        type: 'text' as const,
        baseLanguage: 'fr',
        languageVersions: [],
        aiVersions: [],
        createdAt: now,
        updatedAt: now,
      };
    }),
    // Présentations (1 à 5)
    ...Array.from({ length: 5 }, (_, i): UserDataField => {
      const num = i + 1;
      return {
        id: `presentation${num}`,
        name: `Présentation ${num}`,
        tag: `Presentation${num}`,
        type: 'text' as const,
        baseLanguage: 'fr',
        languageVersions: [],
        aiVersions: [],
        createdAt: now,
        updatedAt: now,
      };
    }),
  ];
};
