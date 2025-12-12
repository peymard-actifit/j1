// Utilitaires pour les traductions avec DeepL

import { api } from './api';
import { UserDataField, LanguageVersion } from '../types/database';

export const translateField = async (
  field: UserDataField,
  targetLang: string,
  version: number = 1
): Promise<string> => {
  // Récupérer la valeur dans la langue de base (version 1 par défaut)
  const baseValue = field.aiVersions.find(v => v.version === version)?.value || 
                    field.aiVersions.find(v => v.version === 1)?.value || '';

  if (!baseValue) {
    throw new Error('Aucune valeur de base trouvée pour ce champ');
  }

  // Vérifier si la traduction existe déjà pour cette version
  const existingTranslation = field.languageVersions.find(
    v => v.language === targetLang && v.version === version
  );

  if (existingTranslation) {
    return existingTranslation.value;
  }

  // Traduire avec DeepL
  const result = await api.translate(baseValue, targetLang, field.baseLanguage);

  if (!result.success) {
    throw new Error(result.error || 'Erreur lors de la traduction');
  }

  return result.text;
};

export const translateAllFields = async (
  fields: UserDataField[],
  targetLang: string,
  version: number = 1
): Promise<Record<string, string>> => {
  // Récupérer toutes les valeurs de base (version spécifiée)
  const textsToTranslate: string[] = [];
  const fieldIds: string[] = [];

  fields.forEach(field => {
    const baseValue = field.aiVersions.find(v => v.version === version)?.value || 
                      field.aiVersions.find(v => v.version === 1)?.value || '';

    if (baseValue) {
      textsToTranslate.push(baseValue);
      fieldIds.push(field.id);
    }
  });

  if (textsToTranslate.length === 0) {
    return {};
  }

  // Traduire en batch avec DeepL
  const baseLang = fields[0]?.baseLanguage || 'fr';
  const result = await api.translateBatch(textsToTranslate, targetLang, baseLang);

  if (!result.success) {
    throw new Error(result.error || 'Erreur lors de la traduction');
  }

  // Créer un objet avec les traductions
  const translations: Record<string, string> = {};
  result.texts.forEach((translatedText: string, index: number) => {
    translations[fieldIds[index]] = translatedText;
  });

  return translations;
};

export const addTranslationToField = (
  field: UserDataField,
  language: string,
  value: string,
  version: number = 1
): UserDataField => {
  // Vérifier si la traduction existe déjà pour cette version
  const existingIndex = field.languageVersions.findIndex(
    v => v.language === language && v.version === version
  );

  const newVersion: LanguageVersion = {
    language,
    version,
    value,
    createdAt: new Date().toISOString(),
  };

  const updatedVersions = existingIndex >= 0
    ? field.languageVersions.map((v, idx) => idx === existingIndex ? newVersion : v)
    : [...field.languageVersions, newVersion];

  // Trier par langue puis par version
  updatedVersions.sort((a, b) => {
    if (a.language !== b.language) {
      return a.language.localeCompare(b.language);
    }
    return a.version - b.version;
  });

  return {
    ...field,
    languageVersions: updatedVersions,
    updatedAt: new Date().toISOString(),
  };
};








