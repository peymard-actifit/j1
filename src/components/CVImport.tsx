import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { UserDataField } from '../types/database';
import { analyzeCVFile } from '../utils/ai';
import { CVDragDropMapper } from './CVDragDropMapper';
import './CVImport.css';

interface CVImportProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface ExtractedData {
  [key: string]: any;
}

interface FieldMapping {
  fieldId: string;
  extractedKey: string;
  extractedValue: string;
  targetLanguage: string;
  targetVersion: 1 | 2 | 3; // Version AI (1, 2 ou 3)
  confirmed: boolean;
}

export const CVImport = ({ onComplete, onCancel }: CVImportProps) => {
  const { user, setUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [userFields, setUserFields] = useState<UserDataField[]>([]);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'analyze' | 'map' | 'dragdrop' | 'saving'>('select');

  useEffect(() => {
    if (user) {
      if (user.data && user.data.length > 0) {
        setUserFields(user.data);
      } else {
        // Initialiser avec la structure par défaut si l'utilisateur n'a pas encore de données
        const { initializeDefaultStructure } = require('../utils/storage');
        const defaultFields = initializeDefaultStructure();
        setUserFields(defaultFields);
      }
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    setAnalyzing(true);
    setError('');
    setStep('analyze');

    try {
      // Analyser avec l'API IA
      const analysis = await analyzeCVFile(file);
      setExtractedData(analysis);
      
      // Générer des mappings automatiques
      const autoMappings = generateAutoMappings(analysis, userFields);
      setMappings(autoMappings);
      // Proposer le mode drag & drop après l'analyse
      setStep('dragdrop');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'analyse du CV');
      setStep('select');
    } finally {
      setAnalyzing(false);
    }
  };

  // Fonction pour vérifier si une valeur existe déjà dans un champ
  const valueExistsInField = (field: UserDataField, value: string, language: string): { exists: boolean; version?: number } => {
    const normalizedValue = value.trim().toLowerCase();
    
    if (language === field.baseLanguage) {
      // Vérifier dans aiVersions
      for (const aiVersion of field.aiVersions || []) {
        if (aiVersion.value.trim().toLowerCase() === normalizedValue) {
          return { exists: true, version: aiVersion.version };
        }
      }
    } else {
      // Vérifier dans languageVersions
      for (const langVersion of field.languageVersions || []) {
        if (langVersion.language === language && langVersion.value.trim().toLowerCase() === normalizedValue) {
          return { exists: true, version: langVersion.version };
        }
      }
    }
    
    return { exists: false };
  };

  // Fonction pour trouver la première version disponible
  const findAvailableVersion = (field: UserDataField, language: string): 1 | 2 | 3 => {
    if (language === field.baseLanguage) {
      const existingVersions = (field.aiVersions || []).map(v => v.version);
      for (let v = 1; v <= 3; v++) {
        if (!existingVersions.includes(v)) {
          return v as 1 | 2 | 3;
        }
      }
      // Si toutes les versions existent, retourner la version 1 par défaut
      return 1;
    } else {
      const existingVersions = (field.languageVersions || [])
        .filter(lv => lv.language === language)
        .map(lv => lv.version);
      for (let v = 1; v <= 3; v++) {
        if (!existingVersions.includes(v)) {
          return v as 1 | 2 | 3;
        }
      }
      return 1;
    }
  };

  const generateAutoMappings = (extracted: ExtractedData, fields: UserDataField[]): FieldMapping[] => {
    const mappings: FieldMapping[] = [];
    const baseLanguage = user?.baseLanguage || 'fr';

    // Mapping automatique amélioré basé sur les tags et noms de champs
    // Ajout de plus de variations pour améliorer la reconnaissance
    const fieldMap: Record<string, string[]> = {
      'prenom': ['firstname', 'firstName', 'prenom', 'prénom', 'first_name', 'first name', 'givenname', 'given name'],
      'nom': ['lastname', 'lastName', 'nom', 'surname', 'name', 'last_name', 'last name', 'familyname', 'family name'],
      'mail': ['email', 'mail', 'courriel', 'e-mail', 'e_mail', 'emailaddress', 'email address'],
      'telephone': ['phone', 'telephone', 'tel', 'mobile', 'téléphone', 'phone_number', 'phone number', 'phonenumber'],
      'adresse01': ['addressline1', 'addressLine1', 'adresse', 'street', 'rue', 'address', 'address_line1', 'address line1', 'address1'],
      'adresse02': ['addressline2', 'addressLine2', 'adresse2', 'address_line2', 'address line2', 'address2'],
      'codepostal': ['postalcode', 'postalCode', 'codepostal', 'codePostal', 'zip', 'zipcode', 'postal_code', 'postal code', 'cp'],
      'ville': ['city', 'ville', 'town'],
      'pays': ['country', 'pays', 'nation'],
      'region': ['region', 'région', 'state', 'province', 'département', 'departement'],
      'datedenaissance': ['birthdate', 'birthDate', 'datedenaissance', 'dateDeNaissance', 'dob', 'birth_date', 'birth date', 'dateofbirth', 'date of birth'],
      'lieudenaissance': ['birthplace', 'birthPlace', 'lieudenaissance', 'lieuDeNaissance', 'birth_place', 'birth place', 'placeofbirth', 'place of birth'],
      'posterecherche': ['jobtitle', 'jobTitle', 'posterecherche', 'posteRecherche', 'position', 'job_title', 'job title', 'title', 'poste', 'fonction'],
      'resumeprofessionnel': ['summary', 'resume', 'resumeprofessionnel', 'résumé', 'profil', 'profile', 'about', 'aboutme', 'about me', 'description', 'presentation'],
      'langue01': ['languages', 'langue', 'language', 'lang', 'langues'],
      'niveaulangue01': ['languagelevel', 'languageLevel', 'niveaulangue', 'language_level', 'language level', 'level'],
    };

    // Parcourir les champs utilisateur et créer des mappings automatiques
    fields.forEach(field => {
      const possibleKeys = fieldMap[field.id] || [
        field.tag.toLowerCase(),
        field.name.toLowerCase(),
        field.id.toLowerCase(),
        // Ajouter aussi des variations du tag
        field.tag.toLowerCase().replace(/[^a-z0-9]/g, ''),
        field.tag.toLowerCase().replace(/_/g, ''),
        field.tag.toLowerCase().replace(/-/g, ''),
      ];
      
      // Chercher une correspondance dans les données extraites
      for (const [key, value] of Object.entries(extracted)) {
        const keyLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matches = possibleKeys.some(pk => {
          const pkClean = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
          // Améliorer le matching : correspondance exacte, contient, ou est contenu
          return keyLower === pkClean || 
                 keyLower.includes(pkClean) || 
                 pkClean.includes(keyLower) ||
                 key.toLowerCase() === pk.toLowerCase() ||
                 key.toLowerCase().includes(pk.toLowerCase()) ||
                 pk.toLowerCase().includes(key.toLowerCase());
        });
        
        if (matches && value !== null && value !== undefined) {
          let stringValue = '';
          if (typeof value === 'string') {
            stringValue = value.trim();
          } else if (Array.isArray(value)) {
            stringValue = value.join(', ');
          } else {
            stringValue = String(value);
          }
          
          if (stringValue) {
            // Vérifier si la valeur existe déjà dans le champ
            const existsCheck = valueExistsInField(field, stringValue, baseLanguage);
            
            if (!existsCheck.exists) {
              // Trouver la première version disponible
              const availableVersion = findAvailableVersion(field, baseLanguage);
              
              mappings.push({
                fieldId: field.id,
                extractedKey: key,
                extractedValue: stringValue,
                targetLanguage: baseLanguage,
                targetVersion: availableVersion,
                confirmed: false,
              });
            }
            // Si la valeur existe déjà, on ne crée pas de mapping
            break; // Une seule correspondance par champ
          }
        }
      }
    });

    // Gérer les expériences professionnelles (XP01 à XP10)
    if (extracted.experience && Array.isArray(extracted.experience)) {
      extracted.experience.slice(0, 10).forEach((exp: any, idx: number) => {
        const num = String(idx + 1).padStart(2, '0');
        const xpFields = fields.filter(f => f.id.startsWith(`xp${num}`));
        
        xpFields.forEach(field => {
          const fieldType = field.id.replace(`xp${num}`, '').toLowerCase();
          let value = '';
          
          if (fieldType.includes('entreprise') || fieldType.includes('company')) {
            value = exp.company || '';
          } else if (fieldType.includes('poste') || fieldType.includes('title')) {
            value = exp.title || '';
          } else if (fieldType.includes('datedebut') || fieldType.includes('startdate')) {
            value = exp.startDate || '';
          } else if (fieldType.includes('datefin') || fieldType.includes('enddate')) {
            value = exp.endDate || '';
          } else if (fieldType.includes('mission') || fieldType.includes('description')) {
            value = exp.description || exp.mission || '';
          } else if (fieldType.includes('resultats') || fieldType.includes('results')) {
            value = exp.results || '';
          }
          
          if (value && typeof value === 'string' && value.trim()) {
            // Vérifier si la valeur existe déjà
            const existsCheck = valueExistsInField(field, value.trim(), baseLanguage);
            
            if (!existsCheck.exists) {
              const availableVersion = findAvailableVersion(field, baseLanguage);
              mappings.push({
                fieldId: field.id,
                extractedKey: `experience[${idx}].${fieldType}`,
                extractedValue: value.trim(),
                targetLanguage: baseLanguage,
                targetVersion: availableVersion,
                confirmed: false,
              });
            }
          }
        });
      });
    }

    // Gérer les formations (FOR01 à FOR10)
    if (extracted.education && Array.isArray(extracted.education)) {
      extracted.education.slice(0, 10).forEach((edu: any, idx: number) => {
        const num = String(idx + 1).padStart(2, '0');
        const forFields = fields.filter(f => f.id.startsWith(`for${num}`));
        
        forFields.forEach(field => {
          const fieldType = field.id.replace(`for${num}`, '').toLowerCase();
          let value = '';
          
          if (fieldType.includes('diplome') || fieldType.includes('degree')) {
            value = edu.degree || '';
          } else if (fieldType.includes('ecole') || fieldType.includes('school')) {
            value = edu.school || '';
          } else if (fieldType.includes('datedebut') || fieldType.includes('startdate')) {
            value = edu.startDate || '';
          } else if (fieldType.includes('datefin') || fieldType.includes('enddate')) {
            value = edu.endDate || '';
          } else if (fieldType.includes('description')) {
            value = edu.description || '';
          }
          
          if (value && typeof value === 'string' && value.trim()) {
            // Vérifier si la valeur existe déjà
            const existsCheck = valueExistsInField(field, value.trim(), baseLanguage);
            
            if (!existsCheck.exists) {
              const availableVersion = findAvailableVersion(field, baseLanguage);
              mappings.push({
                fieldId: field.id,
                extractedKey: `education[${idx}].${fieldType}`,
                extractedValue: value.trim(),
                targetLanguage: baseLanguage,
                targetVersion: availableVersion,
                confirmed: false,
              });
            }
          }
        });
      });
    }

    // Gérer les compétences
    if (extracted.skills && Array.isArray(extracted.skills)) {
      const skillsText = extracted.skills.join(', ');
      const skillsField = fields.find(f => f.id === 'competences' || f.tag.toLowerCase().includes('competence'));
      if (skillsField && skillsText) {
        const existsCheck = valueExistsInField(skillsField, skillsText, baseLanguage);
        if (!existsCheck.exists) {
          const availableVersion = findAvailableVersion(skillsField, baseLanguage);
          mappings.push({
            fieldId: skillsField.id,
            extractedKey: 'skills',
            extractedValue: skillsText,
            targetLanguage: baseLanguage,
            targetVersion: availableVersion,
            confirmed: false,
          });
        }
      }
    }

    // Gérer les langues
    if (extracted.languages && Array.isArray(extracted.languages)) {
      extracted.languages.forEach((lang: any, idx: number) => {
        if (idx === 0) {
          // Langue principale
          const langField = fields.find(f => f.id === 'langue01');
          const levelField = fields.find(f => f.id === 'niveaulangue01');
          
          if (langField && lang.language) {
            const existsCheck = valueExistsInField(langField, lang.language, baseLanguage);
            if (!existsCheck.exists) {
              const availableVersion = findAvailableVersion(langField, baseLanguage);
              mappings.push({
                fieldId: langField.id,
                extractedKey: `languages[0].language`,
                extractedValue: lang.language,
                targetLanguage: baseLanguage,
                targetVersion: availableVersion,
                confirmed: false,
              });
            }
          }
          
          if (levelField && lang.level) {
            const existsCheck = valueExistsInField(levelField, lang.level, baseLanguage);
            if (!existsCheck.exists) {
              const availableVersion = findAvailableVersion(levelField, baseLanguage);
              mappings.push({
                fieldId: levelField.id,
                extractedKey: `languages[0].level`,
                extractedValue: lang.level,
                targetLanguage: baseLanguage,
                targetVersion: availableVersion,
                confirmed: false,
              });
            }
          }
        }
      });
    }

    return mappings;
  };

  const handleMappingChange = (index: number, updates: Partial<FieldMapping>) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], ...updates };
    setMappings(updated);
  };

  const handleConfirmMapping = (index: number) => {
    const updated = [...mappings];
    updated[index].confirmed = true;
    setMappings(updated);
  };

  const handleSaveMappings = async () => {
    if (!user || !setUser) return;

    setStep('saving');
    setError('');

    try {
      const updatedFields = [...userFields];

      // Appliquer les mappings confirmés
      mappings.filter(m => m.confirmed).forEach(mapping => {
        const field = updatedFields.find(f => f.id === mapping.fieldId);
        if (!field) return;

        // Mettre à jour la valeur de base ou ajouter une version de langue
        // Toutes les langues (y compris la langue de base) ont maintenant 3 versions possibles
        if (mapping.targetLanguage === field.baseLanguage) {
          // Pour la langue de base, utiliser aiVersions (versions 1, 2 ou 3)
          if (!field.aiVersions) {
            field.aiVersions = [];
          }
          
          const existingVersion = field.aiVersions.find(v => v.version === mapping.targetVersion);
          if (existingVersion) {
            existingVersion.value = mapping.extractedValue;
            existingVersion.createdAt = new Date().toISOString();
          } else {
            field.aiVersions.push({
              version: mapping.targetVersion,
              value: mapping.extractedValue,
              createdAt: new Date().toISOString(),
            });
            // Trier par version pour maintenir l'ordre
            field.aiVersions.sort((a, b) => a.version - b.version);
          }
        } else {
          // Pour les autres langues, utiliser languageVersions avec 3 versions possibles (1, 2 ou 3)
          if (!field.languageVersions) {
            field.languageVersions = [];
          }
          
          const existingLangVersion = field.languageVersions.find(
            lv => lv.language === mapping.targetLanguage && lv.version === mapping.targetVersion
          );
          if (existingLangVersion) {
            existingLangVersion.value = mapping.extractedValue;
            existingLangVersion.createdAt = new Date().toISOString();
          } else {
            field.languageVersions.push({
              language: mapping.targetLanguage,
              version: mapping.targetVersion,
              value: mapping.extractedValue,
              createdAt: new Date().toISOString(),
            });
            // Trier par langue puis par version
            field.languageVersions.sort((a, b) => {
              if (a.language !== b.language) {
                return a.language.localeCompare(b.language);
              }
              return a.version - b.version;
            });
          }
        }

        field.updatedAt = new Date().toISOString();
      });

      // Sauvegarder les champs mis à jour
      const updatedUser = { ...user, data: updatedFields };
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
      setStep('map');
    }
  };


  const getAvailableLanguages = (): string[] => {
    return ['fr', 'en', 'es', 'de', 'it', 'pt'];
  };

  return (
    <div className="cv-import-overlay">
      <div className="cv-import">
        <div className="cv-import-header">
          <h2>Importer un CV</h2>
          <button onClick={onCancel} className="close-button">✕</button>
        </div>

        <div className="cv-import-content">
          {step === 'select' && (
            <div className="cv-import-step">
              <p className="step-description">
                Sélectionnez un fichier CV à importer. Formats acceptés : PDF, Word, Excel, PowerPoint, LaTeX, JSON
              </p>
              
              <div className="file-selector">
                <label className="file-upload-label">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.tex,.json"
                    onChange={handleFileChange}
                    className="file-input"
                  />
                  <span className="file-upload-button">Choisir un fichier</span>
                </label>
                {file && (
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                  </div>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="cv-import-actions">
                <button onClick={onCancel} className="button-secondary">Annuler</button>
                <button
                  onClick={handleAnalyze}
                  className="button-primary"
                  disabled={!file || analyzing}
                >
                  {analyzing ? 'Analyse en cours...' : 'Analyser avec IA'}
                </button>
              </div>
            </div>
          )}

          {step === 'analyze' && (
            <div className="cv-import-step">
              <div className="loading-spinner">
                <p>Analyse du CV en cours...</p>
                <p className="loading-subtitle">Extraction des données avec l'IA</p>
              </div>
            </div>
          )}

          {step === 'dragdrop' && extractedData && (
            <CVDragDropMapper
              extractedData={extractedData}
              userFields={userFields}
              onComplete={onComplete}
              onCancel={() => setStep('select')}
            />
          )}

          {step === 'map' && extractedData && (
            <div className="cv-import-step">
              <h3>Validation et mapping des données</h3>
              <p className="step-description">
                Vérifiez et validez les correspondances entre les données extraites et vos champs CV.
                Vous pouvez assigner chaque valeur à un champ, une langue et une version (1, 2 ou 3).
              </p>

              <div className="mappings-summary">
                <p className="summary-text">
                  <strong>{mappings.length}</strong> correspondance(s) trouvée(s). 
                  <strong className="confirmed-count"> {mappings.filter(m => m.confirmed).length}</strong> validée(s).
                </p>
                <button
                  onClick={() => {
                    const allValid = mappings.map(m => {
                      if (m.fieldId) {
                        return { ...m, confirmed: true };
                      }
                      return m;
                    });
                    setMappings(allValid);
                  }}
                  className="button-bulk-confirm"
                  disabled={mappings.filter(m => m.fieldId && !m.confirmed).length === 0}
                >
                  ✓ Valider toutes les correspondances
                </button>
              </div>

              <div className="mappings-list">
                {mappings.length === 0 ? (
                  <p className="no-mappings">Aucune correspondance automatique trouvée. Vous pouvez ajouter manuellement des mappings.</p>
                ) : (
                  <div className="mappings-table-container">
                    <table className="mappings-table">
                      <thead>
                        <tr>
                          <th>Donnée extraite</th>
                          <th>Valeur</th>
                          <th>Champ cible</th>
                          <th>Langue</th>
                          <th>Version</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((mapping, index) => (
                          <tr key={index} className={`mapping-row ${mapping.confirmed ? 'confirmed' : ''}`}>
                            <td className="mapping-source-cell">
                              <strong>{mapping.extractedKey}</strong>
                            </td>
                            <td className="mapping-value-cell">
                              <div className="source-value-preview" title={mapping.extractedValue}>
                                {mapping.extractedValue.length > 50 
                                  ? mapping.extractedValue.substring(0, 50) + '...' 
                                  : mapping.extractedValue}
                              </div>
                            </td>
                            <td className="mapping-field-cell">
                              <select
                                value={mapping.fieldId}
                                onChange={(e) => handleMappingChange(index, { fieldId: e.target.value })}
                                disabled={mapping.confirmed}
                                className="field-select"
                              >
                                <option value="">-- Sélectionner --</option>
                                {userFields.map(field => (
                                  <option key={field.id} value={field.id}>
                                    {field.name} ({field.tag})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="mapping-lang-cell">
                              <select
                                value={mapping.targetLanguage}
                                onChange={(e) => handleMappingChange(index, { targetLanguage: e.target.value })}
                                disabled={mapping.confirmed}
                                className="lang-select"
                              >
                                {getAvailableLanguages().map(lang => (
                                  <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                                ))}
                              </select>
                            </td>
                            <td className="mapping-version-cell">
                              <div className="version-buttons">
                                {[1, 2, 3].map(version => (
                                  <button
                                    key={version}
                                    type="button"
                                    className={`version-button ${mapping.targetVersion === version ? 'active' : ''}`}
                                    onClick={() => handleMappingChange(index, { targetVersion: version as 1 | 2 | 3 })}
                                    disabled={mapping.confirmed}
                                    title={`Version ${version}`}
                                  >
                                    {version}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="mapping-action-cell">
                              {!mapping.confirmed ? (
                                <button
                                  onClick={() => handleConfirmMapping(index)}
                                  className="button-confirm-small"
                                  disabled={!mapping.fieldId}
                                  title="Valider ce mapping"
                                >
                                  ✓
                                </button>
                              ) : (
                                <div className="mapping-confirmed-small">
                                  <span className="confirmed-badge-small" title="Validé">✓</span>
                                  <button
                                    onClick={() => handleMappingChange(index, { confirmed: false })}
                                    className="button-edit-small"
                                    title="Modifier"
                                  >
                                    ✎
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="cv-import-actions">
                <button onClick={() => setStep('select')} className="button-secondary">Retour</button>
                <button
                  onClick={handleSaveMappings}
                  className="button-primary"
                  disabled={mappings.filter(m => m.confirmed).length === 0}
                >
                  {`Sauvegarder (${mappings.filter(m => m.confirmed).length} validés)`}
                </button>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="cv-import-step">
              <div className="loading-spinner">
                <p>Sauvegarde des données en cours...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


