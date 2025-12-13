import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { UserDataField } from '../types/database';
import { analyzeCVFile } from '../utils/ai';
import { FieldEditor } from './DataEditor';
import { addTranslationToField } from '../utils/translation';
import './CVImportNew.css';

interface CVImportNewProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const CVImportNew = ({ onCancel }: CVImportNewProps) => {
  const { user, setUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [pdfTextContent, setPdfTextContent] = useState<string>('');
  const [extractingPdfText, setExtractingPdfText] = useState(false);
  const [userFields, setUserFields] = useState<UserDataField[]>([]);
  const [selectedField, setSelectedField] = useState<UserDataField | null>(null);
  const [workingLanguage, setWorkingLanguage] = useState<string>(user?.baseLanguage || 'fr');
  const [selectedText, setSelectedText] = useState<string>('');
  const cvDisplayRef = useRef<HTMLDivElement>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldTag, setNewFieldTag] = useState('');

  useEffect(() => {
    if (user) {
      if (user.data && user.data.length > 0) {
        setUserFields(user.data);
      } else {
        const { initializeDefaultStructure } = require('../utils/storage');
        const defaultFields = initializeDefaultStructure();
        setUserFields(defaultFields);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && !workingLanguage) {
      setWorkingLanguage(user.baseLanguage || 'fr');
    }
  }, [user?.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileType(selectedFile.type);
      setPdfTextContent('');
      
      // Lire le contenu du fichier pour l'affichage
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        setFileContent(content);
        
        // Si c'est un PDF, extraire le texte pour permettre la sélection
        if (selectedFile.type === 'application/pdf') {
          setExtractingPdfText(true);
          try {
            // Utiliser l'API documint pour extraire le texte du PDF
            const result = await api.extractPdfText(content);
            if (result.success && result.text) {
              setPdfTextContent(result.text);
            } else {
              // Fallback : afficher un message
              setPdfTextContent('Impossible d\'extraire le texte du PDF. Veuillez utiliser un autre format.');
            }
          } catch (error) {
            console.error('Error extracting PDF text:', error);
            setPdfTextContent('Erreur lors de l\'extraction du texte du PDF.');
          } finally {
            setExtractingPdfText(false);
          }
        } else {
          // Pour les autres formats, on affiche le texte directement
          setFileContent(content);
        }
      };
      
      if (selectedFile.type === 'application/pdf') {
        reader.readAsDataURL(selectedFile);
      } else {
        reader.readAsText(selectedFile);
      }
    }
  };

  // Fonction pour vérifier si une valeur existe déjà dans un champ
  const valueExistsInField = (field: UserDataField, value: string, language: string): boolean => {
    const normalizedValue = value.trim().toLowerCase();
    if (language === field.baseLanguage) {
      for (const aiVersion of field.aiVersions || []) {
        if (aiVersion.value.trim().toLowerCase() === normalizedValue) return true;
      }
    } else {
      for (const langVersion of field.languageVersions || []) {
        if (langVersion.language === language && langVersion.value.trim().toLowerCase() === normalizedValue) return true;
      }
    }
    return false;
  };

  // Fonction pour trouver la première version disponible (ou la version 3 si toutes sont remplies)
  const findAvailableVersion = (field: UserDataField, language: string): 1 | 2 | 3 => {
    if (language === field.baseLanguage) {
      const existingVersions = (field.aiVersions || []).map(v => v.version);
      for (let v = 1; v <= 3; v++) {
        if (!existingVersions.includes(v)) return v as 1 | 2 | 3;
      }
      return 3;
    } else {
      const existingVersions = (field.languageVersions || []).filter(lv => lv.language === language).map(lv => lv.version);
      for (let v = 1; v <= 3; v++) {
        if (!existingVersions.includes(v)) return v as 1 | 2 | 3;
      }
      return 3;
    }
  };

  // Fonction pour mapper automatiquement les données extraites aux champs avec feedback visuel
  const autoMapCVData = async (
    extracted: any, 
    fields: UserDataField[], 
    targetLanguage: string,
    onProgress?: (step: string, text?: string, field?: string, version?: number) => void
  ): Promise<UserDataField[]> => {
    const fieldMap: Record<string, string[]> = {
      'prenom': ['firstname', 'firstName', 'prenom', 'prénom'],
      'nom': ['lastname', 'lastName', 'nom', 'surname'],
      'mail': ['email', 'mail', 'courriel'],
      'telephone': ['phone', 'telephone', 'tel', 'mobile'],
      'posterecherche': ['jobtitle', 'jobTitle', 'posterecherche', 'position'],
      'resumeprofessionnel': ['summary', 'resume', 'résumé', 'profil'],
    };
    const mappedKeys = new Set<string>();
    const updatedFields = fields.map(f => ({ ...f }));

    onProgress?.('Début du parsing des données...');

    // Mapper les champs simples
    Object.entries(extracted).forEach(([key, value]) => {
      if (!value || typeof value === 'object' || Array.isArray(value)) return;
      const valueStr = String(value).trim();
      if (!valueStr) return;

      onProgress?.(`Analyse de "${key}"...`, valueStr.substring(0, 50));

      updatedFields.forEach((field) => {
        if (mappedKeys.has(key)) return;
        const possibleKeys = fieldMap[field.id] || [field.tag.toLowerCase(), field.name.toLowerCase(), field.id.toLowerCase()];
        const keyLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matches = possibleKeys.some(pk => {
          const pkClean = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
          return keyLower === pkClean || keyLower.includes(pkClean) || pkClean.includes(keyLower);
        });

        if (matches && !valueExistsInField(field, valueStr, targetLanguage)) {
          const availableVersion = findAvailableVersion(field, targetLanguage);
          onProgress?.(`→ Mapping "${key}" vers "${field.name}" (version ${availableVersion})`, valueStr, field.name, availableVersion);
          
          if (targetLanguage === field.baseLanguage) {
            const existingVersions = field.aiVersions || [];
            const versionIndex = existingVersions.findIndex(v => v.version === availableVersion);
            if (versionIndex >= 0) {
              existingVersions[versionIndex].value = valueStr;
            } else {
              existingVersions.push({ version: availableVersion, value: valueStr, createdAt: new Date().toISOString() });
              existingVersions.sort((a, b) => a.version - b.version);
            }
            field.aiVersions = existingVersions;
          } else {
            const updated = addTranslationToField(field, targetLanguage, valueStr, availableVersion);
            Object.assign(field, updated);
          }
          mappedKeys.add(key);
        }
      });
    });

    onProgress?.('Parsing terminé !');
    return updatedFields;
  };

  const handleImport = async () => {
    if (!file) {
      return;
    }

    setAnalyzing(true);
    setParsingSteps([]);
    setAnalysisProgress('Démarrage de l\'analyse...');

    try {
      setAnalysisProgress('Extraction du texte du CV...');
      setParsingSteps([{ step: 'Extraction du texte du CV...' }]);
      
      const analysis = await analyzeCVFile(file, userFields);
      
      setAnalysisProgress('Parsing des données et remplissage automatique des champs...');
      setParsingSteps([{ step: 'Parsing des données...' }]);
      
      const updatedFields = await autoMapCVData(
        analysis, 
        userFields, 
        workingLanguage,
        (step, text, field, version) => {
          setParsingSteps(prev => [...prev, { step, text, field, version }]);
          setAnalysisProgress(step);
        }
      );
      setUserFields(updatedFields);
      
      if (user && setUser) {
        const updatedUser = { ...user, data: updatedFields };
        const savedUser = await storage.saveUser(updatedUser);
        setUser(savedUser);
      }
      
      setAnalysisProgress('Import terminé ! Les données ont été automatiquement placées dans les champs.');
      setParsingSteps(prev => [...prev, { step: 'Import terminé !' }]);
    } catch (error: any) {
      console.error('Error analyzing CV:', error);
      setAnalysisProgress(`Erreur: ${error.message}`);
      setParsingSteps(prev => [...prev, { step: `Erreur: ${error.message}` }]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddField = async () => {
    if (!user || !setUser || !newFieldName.trim() || !newFieldTag.trim()) {
      return;
    }

    const newField: UserDataField = {
      id: `field-${Date.now()}`,
      name: newFieldName.trim(),
      tag: newFieldTag.trim(),
      type: 'text',
      baseLanguage: workingLanguage,
      aiVersions: [],
      languageVersions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedFields = [...userFields, newField];
    setUserFields(updatedFields);
    setSelectedField(newField);
    setShowAddField(false);
    setNewFieldName('');
    setNewFieldTag('');

    try {
      const updatedUser = { ...user, data: updatedFields };
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);
    } catch (error) {
      console.error('Error adding field:', error);
      alert('Erreur lors de l\'ajout du champ');
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      setSelectedText(text);
      
      // La position du texte sélectionné est stockée dans selectedText
    }
  };

  const handleDragStart = (e: React.DragEvent, text: string) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = async (field: UserDataField, version: 1 | 2 | 3, language: string, e: React.DragEvent) => {
    e.preventDefault();
    const text = e.dataTransfer.getData('text/plain');
    if (!text || !field) return;

    // Mettre à jour le champ avec le texte déposé
    const updatedField = { ...field };
    
    if (language === field.baseLanguage) {
      // Mettre à jour aiVersions
      const existingVersions = updatedField.aiVersions || [];
      const versionIndex = existingVersions.findIndex(v => v.version === version);
      
      if (versionIndex >= 0) {
        existingVersions[versionIndex].value = text;
      } else {
        existingVersions.push({
          version,
          value: text,
          createdAt: new Date().toISOString(),
        });
        existingVersions.sort((a, b) => a.version - b.version);
      }
      updatedField.aiVersions = existingVersions;
    } else {
      // Mettre à jour languageVersions
      const existingLangVersions = updatedField.languageVersions || [];
      const langVersionIndex = existingLangVersions.findIndex(
        lv => lv.language === language && lv.version === version
      );
      
      if (langVersionIndex >= 0) {
        existingLangVersions[langVersionIndex].value = text;
      } else {
        existingLangVersions.push({
          language,
          version,
          value: text,
          createdAt: new Date().toISOString(),
        });
      }
      updatedField.languageVersions = existingLangVersions;
    }

    // Sauvegarder
    const updatedFields = userFields.map(f => f.id === field.id ? updatedField : f);
    setUserFields(updatedFields);
    
    if (user && setUser) {
      const updatedUser = { ...user, data: updatedFields };
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);
    }

    // Mettre à jour le champ sélectionné si c'est celui-ci
    if (selectedField?.id === field.id) {
      setSelectedField(updatedField);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleChangeWorkingLanguage = async (newLanguage: string) => {
    if (!user || !setUser) return;
    if (newLanguage === workingLanguage) return;
    
    setWorkingLanguage(newLanguage);
    
    const updatedUser = { ...user, baseLanguage: newLanguage };
    try {
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);
    } catch (error) {
      console.error('Error updating working language:', error);
      setWorkingLanguage(user.baseLanguage || 'fr');
    }
  };

  const handleSaveField = async (field: UserDataField) => {
    const updated = userFields.map(f => f.id === field.id ? field : f);
    setUserFields(updated);
    setSelectedField(field);
    
    if (user && setUser) {
      try {
        const updatedUser = { ...user, data: updated };
        const savedUser = await storage.saveUser(updatedUser);
        setUser(savedUser);
      } catch (error) {
        console.error('Error saving field:', error);
        alert('Erreur lors de la sauvegarde');
      }
    }
  };

  const availableLanguages = [
    'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko',
    'ar', 'cs', 'da', 'el', 'hu', 'id', 'nb', 'sv', 'tr', 'uk'
  ];

  const getLanguageName = (code: string): string => {
    const names: Record<string, string> = {
      fr: 'Français', en: 'Anglais', es: 'Espagnol', de: 'Allemand',
      it: 'Italien', pt: 'Portugais', nl: 'Néerlandais', pl: 'Polonais',
      ru: 'Russe', ja: 'Japonais', zh: 'Chinois', ko: 'Coréen',
      ar: 'Arabe', cs: 'Tchèque', da: 'Danois', el: 'Grec',
      hu: 'Hongrois', id: 'Indonésien', nb: 'Norvégien', sv: 'Suédois',
      tr: 'Turc', uk: 'Ukrainien'
    };
    return names[code] || code.toUpperCase();
  };

  return (
    <div className="cv-import-new-overlay">
      <div className="cv-import-new">
        <div className="cv-import-new-header">
          <h2>Importer un CV</h2>
          <button onClick={onCancel} className="close-button">✕</button>
        </div>

        <div className="cv-import-new-content">
          {/* Partie gauche : Affichage du CV */}
          <div className="cv-display-panel">
            <div className="cv-display-header">
              <h3>CV importé</h3>
              {!file && (
                <div className="file-selector">
                  <input
                    type="file"
                    id="cv-file-input"
                    accept=".pdf,.doc,.docx,.tex,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={handleFileChange}
                    className="file-input"
                  />
                  <label htmlFor="cv-file-input" className="file-input-label">
                    Choisir un fichier
                  </label>
                </div>
              )}
            </div>

            {extractingPdfText && (
              <div className="analysis-progress">
                <p>Extraction du texte du PDF...</p>
              </div>
            )}

            <div
              ref={cvDisplayRef}
              className="cv-display-content"
              onMouseUp={handleTextSelection}
              onSelect={handleTextSelection}
            >
              {fileType === 'application/pdf' && pdfTextContent ? (
                <div className="text-content">
                  {pdfTextContent.split('\n').map((line, idx) => {
                    const isSelected = selectedText ? line.includes(selectedText) : false;
                    return (
                      <div
                        key={idx}
                        className={`text-line ${isSelected ? 'selected-text' : ''}`}
                        draggable={isSelected && !!selectedText}
                        onDragStart={(e) => {
                          if (selectedText) {
                            handleDragStart(e, selectedText);
                          }
                        }}
                        onMouseDown={(e) => {
                          if (isSelected && selectedText) {
                            // Permettre de recliquer pour glisser
                            e.preventDefault();
                          }
                        }}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : fileContent ? (
                <div className="text-content">
                  {fileContent.split('\n').map((line, idx) => {
                    const isSelected = selectedText ? line.includes(selectedText) : false;
                    return (
                      <div
                        key={idx}
                        className={`text-line ${isSelected ? 'selected-text' : ''}`}
                        draggable={isSelected && !!selectedText}
                        onDragStart={(e) => {
                          if (selectedText) {
                            handleDragStart(e, selectedText);
                          }
                        }}
                        onMouseDown={(e) => {
                          if (isSelected && selectedText) {
                            // Permettre de recliquer pour glisser
                            e.preventDefault();
                          }
                        }}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-cv-message">
                  <p>Sélectionnez un fichier CV pour commencer</p>
                  <p className="hint">Formats acceptés : PDF, Word, Excel, PowerPoint, LaTeX, Texte</p>
                </div>
              )}
            </div>

            {selectedText && (
              <div className="selected-text-info">
                <strong>Texte sélectionné :</strong> "{selectedText.substring(0, 50)}{selectedText.length > 50 ? '...' : ''}"
                <button onClick={() => setSelectedText('')} className="clear-selection">✕</button>
              </div>
            )}
          </div>

          {/* Partie droite : Formulaire d'édition */}
          <div className="fields-editor-panel">
            <div className="fields-editor-header">
              <h3>Champs CV</h3>
              <div className="language-selector">
                <label>Langue de travail :</label>
                <select
                  value={workingLanguage}
                  onChange={(e) => handleChangeWorkingLanguage(e.target.value)}
                  className="language-select"
                >
                  {availableLanguages.map(lang => (
                    <option key={lang} value={lang}>
                      {lang.toUpperCase()} ({getLanguageName(lang)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="fields-list-container">
              <div className="fields-list">
                <div className="fields-list-header-import">
                  <button 
                    onClick={() => setShowAddField(!showAddField)} 
                    className="add-field-button-import"
                  >
                    + Champ
                  </button>
                </div>
                {showAddField && (
                  <div className="add-field-form-import">
                    <input
                      type="text"
                      placeholder="Nom du champ"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="new-field-input"
                    />
                    <input
                      type="text"
                      placeholder="Tag"
                      value={newFieldTag}
                      onChange={(e) => setNewFieldTag(e.target.value)}
                      className="new-field-input"
                    />
                    <div className="add-field-actions">
                      <button onClick={handleAddField} className="confirm-add-button">
                        Ajouter
                      </button>
                      <button onClick={() => {
                        setShowAddField(false);
                        setNewFieldName('');
                        setNewFieldTag('');
                      }} className="cancel-add-button">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
                {userFields.map((field) => (
                  <div
                    key={field.id}
                    className={`field-item ${selectedField?.id === field.id ? 'selected' : ''}`}
                    onClick={() => setSelectedField(field)}
                  >
                    <div className="field-item-content">
                      <span className="field-name">{field.name}</span>
                      <span className="field-tag">{field.tag}</span>
                    </div>
                  </div>
                ))}
              </div>

              {selectedField && (
                <div className="field-editor-container">
                  <FieldEditor
                    field={selectedField}
                    onSave={handleSaveField}
                    workingLanguage={workingLanguage}
                    onChangeWorkingLanguage={handleChangeWorkingLanguage}
                    userBaseLanguage={user?.baseLanguage || 'fr'}
                    onDrop={(version: 1 | 2 | 3, language: string, e: React.DragEvent) => handleDrop(selectedField, version, language, e)}
                    onDragOver={handleDragOver}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

