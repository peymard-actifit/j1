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
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [userFields, setUserFields] = useState<UserDataField[]>([]);
  const [selectedField, setSelectedField] = useState<UserDataField | null>(null);
  const [workingLanguage, setWorkingLanguage] = useState<string>(user?.baseLanguage || 'fr');
  const [selectedText, setSelectedText] = useState<string>('');
  const cvDisplayRef = useRef<HTMLDivElement>(null);

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
      
      // Lire le contenu du fichier pour l'affichage
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        setFileContent(content);
        
        // Si c'est un PDF, on peut utiliser un iframe ou un objet pour l'affichage
        if (selectedFile.type === 'application/pdf') {
          setFileContent(content); // base64 pour PDF
        } else {
          // Pour les autres formats, on affiche le texte
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

  const handleImport = async () => {
    if (!file) {
      return;
    }

    setAnalyzing(true);
    setAnalysisProgress('Démarrage de l\'analyse...');

    try {
      // Analyser avec l'API IA
      setAnalysisProgress('Extraction du texte du CV...');
      await analyzeCVFile(file, userFields);
      setAnalysisProgress('Analyse terminée. Vous pouvez maintenant sélectionner du texte dans le CV.');
    } catch (error: any) {
      console.error('Error analyzing CV:', error);
      setAnalysisProgress(`Erreur: ${error.message}`);
    } finally {
      setAnalyzing(false);
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
              {file && !analyzing && (
                <button onClick={handleImport} className="import-button">
                  Importer le CV
                </button>
              )}
            </div>

            {analysisProgress && (
              <div className="analysis-progress">
                <p>{analysisProgress}</p>
              </div>
            )}

            <div
              ref={cvDisplayRef}
              className="cv-display-content"
              onMouseUp={handleTextSelection}
              onSelect={handleTextSelection}
            >
              {fileType === 'application/pdf' && fileContent ? (
                <iframe
                  src={`${fileContent}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="pdf-viewer"
                  title="CV PDF"
                />
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

