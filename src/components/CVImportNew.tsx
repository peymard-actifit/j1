import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { UserDataField } from '../types/database';
import { FieldEditor } from './DataEditor';
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

  // Fonction pour extraire le texte du PDF avec pdf.js (solution de secours)
  const extractPdfTextWithPdfJs = async (file: File): Promise<void> => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      // Configurer le worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }
      
      if (fullText.trim().length > 0) {
        setPdfTextContent(fullText.trim());
      } else {
        setPdfTextContent('Aucun texte n\'a pu être extrait du PDF. Le PDF pourrait être une image scannée.');
      }
    } catch (error) {
      console.error('Error with pdf.js:', error);
      throw error;
    }
  };

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
            // Essayer d'abord avec l'API documint
            const { api } = await import('../utils/api');
            const result = await api.extractPdfText(content);
            if (result.success && result.text && result.text.trim().length > 0) {
              setPdfTextContent(result.text);
            } else {
              // Fallback : utiliser pdf.js côté client
              await extractPdfTextWithPdfJs(selectedFile);
            }
          } catch (error) {
            console.error('Error extracting PDF text with API:', error);
            // Fallback : utiliser pdf.js côté client
            try {
              await extractPdfTextWithPdfJs(selectedFile);
            } catch (pdfJsError) {
              console.error('Error extracting PDF text with pdf.js:', pdfJsError);
              setPdfTextContent('Erreur lors de l\'extraction du texte du PDF. Veuillez réessayer ou utiliser un autre format.');
            }
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
                <div 
                  className="text-content"
                  onMouseUp={handleTextSelection}
                  onSelect={handleTextSelection}
                >
                  {pdfTextContent.split('\n').map((line, idx) => {
                    const isSelected = selectedText ? line.includes(selectedText) : false;
                    return (
                      <div
                        key={idx}
                        className={`text-line ${isSelected ? 'selected-text' : ''}`}
                        draggable={!!selectedText && selectedText.trim().length > 0}
                        onDragStart={(e) => {
                          if (selectedText && selectedText.trim().length > 0) {
                            handleDragStart(e, selectedText);
                          }
                        }}
                        onMouseDown={() => {
                          // Permettre la sélection de texte
                        }}
                      >
                        {line || '\u00A0'}
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

