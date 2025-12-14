import { UserDataField, LanguageVersion } from '../types/database';

export function addTranslationToField(
  field: UserDataField,
  language: string,
  value: string,
  version: number = 1
): UserDataField {
  const now = new Date().toISOString();
  
  // Vérifier si la traduction existe déjà
  const existingIndex = field.languageVersions.findIndex(
    lv => lv.language === language && lv.version === version
  );

  const newLanguageVersion: LanguageVersion = {
    language,
    version,
    value,
    createdAt: now,
  };

  let updatedLanguageVersions: LanguageVersion[];
  
  if (existingIndex >= 0) {
    // Remplacer la traduction existante
    updatedLanguageVersions = [...field.languageVersions];
    updatedLanguageVersions[existingIndex] = newLanguageVersion;
  } else {
    // Ajouter une nouvelle traduction
    updatedLanguageVersions = [...field.languageVersions, newLanguageVersion];
  }

  return {
    ...field,
    languageVersions: updatedLanguageVersions,
    updatedAt: now,
  };
}
