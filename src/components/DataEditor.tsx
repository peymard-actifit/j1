import { useState, useEffect, useRef } from 'react';
import { UserDataField } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { addTranslationToField } from '../utils/translation';
import { api } from '../utils/api';
import './DataEditor.css';

export const DataEditor = ({ onClose }: { onClose: () => void }) => {
  const { user, setUser } = useAuth();
  const [fields, setFields] = useState<UserDataField[]>([]);
  const [selectedField, setSelectedField] = useState<UserDataField | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (user) {
      setFields(user.data || []);
      // Traduire automatiquement tous les champs au chargement si les traductions n'existent pas
      translateAllFieldsOnLoad(user.data || []);
    }
  }, [user]);

  const translateAllFieldsOnLoad = async (fieldsToTranslate: UserDataField[]) => {
    if (!user || !setUser) return;
    
    const availableLanguages = [
      'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko',
      'ar', 'cs', 'da', 'el', 'hu', 'id', 'nb', 'sv', 'tr', 'uk',
    ];
    
    let hasUpdates = false;
    const updatedFields = await Promise.all(fieldsToTranslate.map(async (field) => {
      let updatedField = { ...field };
      const languagesToTranslate = availableLanguages.filter(lang => lang !== field.baseLanguage);
      
      for (const targetLang of languagesToTranslate) {
        for (let version = 1; version <= 3; version++) {
          // Vérifier si la traduction existe déjà
          const existingTranslation = field.languageVersions.find(
            v => v.language === targetLang && v.version === version
          );
          
          // Si la traduction n'existe pas, la créer
          if (!existingTranslation) {
            const sourceValue = field.aiVersions.find(v => v.version === version)?.value;
            
            if (sourceValue && sourceValue.trim()) {
              try {
                const translationResult = await api.translate(sourceValue, targetLang, field.baseLanguage);
                if (translationResult.success) {
                  updatedField = addTranslationToField(updatedField, targetLang, translationResult.text, version);
                  hasUpdates = true;
                }
              } catch (error: any) {
                console.error(`Error translating ${targetLang} version ${version} for field ${field.id}:`, error);
              }
            }
          }
        }
      }
      
      return updatedField;
    }));

    if (hasUpdates) {
      setFields(updatedFields);
      try {
        const updatedUser = { ...user, data: updatedFields };
        const savedUser = await storage.saveUser(updatedUser);
        setUser(savedUser);
      } catch (error) {
        console.error('Error saving translations:', error);
      }
    }
  };

  const handleAddField = () => {
    const newField: UserDataField = {
      id: Date.now().toString(),
      name: 'Nouveau champ',
      tag: `field_${Date.now()}`,
      type: 'text',
      baseLanguage: user?.baseLanguage || 'fr',
      languageVersions: [],
      aiVersions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFields([...fields, newField]);
    setSelectedField(newField);
    setShowAddField(false);
  };

  const handleSaveField = async (field: UserDataField) => {
    const updated = fields.map(f => f.id === field.id ? field : f);
    setFields(updated);
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

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newFields = [...fields];
    const draggedItem = newFields[draggedIndex];
    newFields.splice(draggedIndex, 1);
    newFields.splice(index, 0, draggedItem);
    setFields(newFields);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex !== null && user && setUser) {
      try {
        const updatedUser = { ...user, data: fields };
        const savedUser = await storage.saveUser(updatedUser);
        setUser(savedUser);
      } catch (error) {
        console.error('Error saving field order:', error);
      }
    }
    setDraggedIndex(null);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce champ ?')) {
      return;
    }

    const updatedFields = fields.filter(f => f.id !== fieldId);
    setFields(updatedFields);
    
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }

    if (user && setUser) {
      try {
        const updatedUser = { ...user, data: updatedFields };
        const savedUser = await storage.saveUser(updatedUser);
        setUser(savedUser);
      } catch (error) {
        console.error('Error deleting field:', error);
        alert('Erreur lors de la suppression du champ');
      }
    }
  };


  // Filtrer les champs selon le texte de recherche
  const filteredFields = fields.filter(field => {
    if (!filterText) return true;
    const searchLower = filterText.toLowerCase();
    return (
      field.name.toLowerCase().includes(searchLower) ||
      field.tag.toLowerCase().includes(searchLower) ||
      field.id.toLowerCase().includes(searchLower) ||
      (field.aiVersions?.some(v => v.value?.toLowerCase().includes(searchLower))) ||
      (field.languageVersions?.some(lv => lv.value?.toLowerCase().includes(searchLower)))
    );
  });



  const handleExportJSON = () => {
    if (!user) return;
    const dataStr = JSON.stringify(user.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cv-data-${Date.now()}.json`;
    link.click();
  };

  return (
    <div className="data-editor-overlay">
      <div className="data-editor">
        <div className="data-editor-header">
          <h2>Édition des données CV</h2>
          <div className="data-editor-actions">
            <button onClick={handleExportJSON} className="export-button">
              📥 Exporter JSON
            </button>
            <button onClick={onClose} className="close-button">
              ✕
            </button>
          </div>
        </div>

        <div className="data-editor-content">
          <div className="fields-list">
            <div className="fields-list-header">
              <input
                type="text"
                placeholder="Filtrer les champs..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="field-filter-input"
              />
              <button onClick={() => setShowAddField(true)} className="add-field-button">
                + Champ
              </button>
            </div>
            {showAddField && (
              <div className="add-field-form">
                <button onClick={handleAddField} className="quick-add-button">
                  Ajouter un champ personnalisé
                </button>
                <button onClick={() => setShowAddField(false)} className="cancel-button">
                  Annuler
                </button>
              </div>
            )}
            <div className="fields-items">
              {filteredFields.length === 0 ? (
                <div className="no-fields-message">
                  {filterText ? 'Aucun champ ne correspond au filtre' : 'Aucun champ'}
                </div>
              ) : (
                filteredFields.map((field) => {
                  // Trouver l'index réel dans le tableau fields pour le drag & drop
                  const realIndex = fields.findIndex(f => f.id === field.id);
                  
                  // Trouver la première valeur non vide (version 1, puis 2, puis 3, puis langues)
                  let firstValue = '';
                  const version1 = field.aiVersions?.find(v => v.version === 1);
                  const version2 = field.aiVersions?.find(v => v.version === 2);
                  const version3 = field.aiVersions?.find(v => v.version === 3);
                  
                  if (version1?.value?.trim()) {
                    firstValue = version1.value;
                  } else if (version2?.value?.trim()) {
                    firstValue = version2.value;
                  } else if (version3?.value?.trim()) {
                    firstValue = version3.value;
                  } else if (field.languageVersions?.length > 0) {
                    const firstLangValue = field.languageVersions.find(lv => lv.value?.trim());
                    if (firstLangValue) {
                      firstValue = firstLangValue.value;
                    }
                  }
                  
                  return (
                    <div
                      key={field.id}
                      className={`field-item ${selectedField?.id === field.id ? 'selected' : ''} ${draggedIndex === realIndex ? 'dragging' : ''}`}
                      onClick={() => setSelectedField(field)}
                      draggable
                      onDragStart={() => handleDragStart(realIndex)}
                      onDragOver={(e) => handleDragOver(e, realIndex)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className="drag-handle">☰</span>
                      <div className="field-item-content">
                        <span className="field-name">{field.name}</span>
                        <span className="field-value-preview">{firstValue || '(vide)'}</span>
                      </div>
                      <div className="field-item-actions">
                        <button
                          className="delete-field-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteField(field.id);
                          }}
                          title="Supprimer ce champ"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="field-editor">
            {selectedField ? (
              <FieldEditor
                field={selectedField}
                onSave={handleSaveField}
              />
            ) : (
              <div className="no-field-selected">
                <p>Sélectionnez un champ pour l'éditer</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

const FieldEditor = ({
  field,
  onSave,
}: {
  field: UserDataField;
  onSave: (field: UserDataField) => void;
}) => {
  const [name, setName] = useState(field.name);
  const [tag, setTag] = useState(field.tag);
  // Récupérer les 3 versions depuis aiVersions
  const [version1Value, setVersion1Value] = useState(
    field.aiVersions.find(v => v.version === 1)?.value || ''
  );
  const [version2Value, setVersion2Value] = useState(
    field.aiVersions.find(v => v.version === 2)?.value || ''
  );
  const [version3Value, setVersion3Value] = useState(
    field.aiVersions.find(v => v.version === 3)?.value || ''
  );
  // Langues disponibles (toutes les langues supportées par DeepL)
  const availableLanguages = [
    'fr', // Français
    'en', // Anglais
    'es', // Espagnol
    'de', // Allemand
    'it', // Italien
    'pt', // Portugais
    'nl', // Néerlandais
    'pl', // Polonais
    'ru', // Russe
    'ja', // Japonais
    'zh', // Chinois
    'ko', // Coréen
    'ar', // Arabe
    'cs', // Tchèque
    'da', // Danois
    'el', // Grec
    'hu', // Hongrois
    'id', // Indonésien
    'nb', // Norvégien
    'sv', // Suédois
    'tr', // Turc
    'uk', // Ukrainien
  ];

  // Mapping des codes de langue vers leurs noms en français
  const languageNames: Record<string, string> = {
    'fr': 'Français',
    'en': 'Anglais',
    'es': 'Espagnol',
    'de': 'Allemand',
    'it': 'Italien',
    'pt': 'Portugais',
    'nl': 'Néerlandais',
    'pl': 'Polonais',
    'ru': 'Russe',
    'ja': 'Japonais',
    'zh': 'Chinois',
    'ko': 'Coréen',
    'ar': 'Arabe',
    'cs': 'Tchèque',
    'da': 'Danois',
    'el': 'Grec',
    'hu': 'Hongrois',
    'id': 'Indonésien',
    'nb': 'Norvégien',
    'sv': 'Suédois',
    'tr': 'Turc',
    'uk': 'Ukrainien',
  };

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevVersion1Ref = useRef<string>('');
  const prevVersion2Ref = useRef<string>('');
  const prevVersion3Ref = useRef<string>('');
  // Stocker les traductions automatiques pour détecter les modifications manuelles
  const autoTranslationsRef = useRef<Record<string, Record<number, string>>>({});

  // Mettre à jour les états quand le champ change
  useEffect(() => {
    const v1 = field.aiVersions.find(v => v.version === 1)?.value || '';
    const v2 = field.aiVersions.find(v => v.version === 2)?.value || '';
    const v3 = field.aiVersions.find(v => v.version === 3)?.value || '';
    
    setName(field.name);
    setTag(field.tag);
    setVersion1Value(v1);
    setVersion2Value(v2);
    setVersion3Value(v3);
    
    prevVersion1Ref.current = v1;
    prevVersion2Ref.current = v2;
    prevVersion3Ref.current = v3;
    
    setIsInitialLoad(true);
    setTimeout(() => setIsInitialLoad(false), 200);
  }, [field.id, field.languageVersions.length]); // Utiliser la longueur pour éviter les re-renders inutiles

  // Traduire automatiquement toutes les langues quand on modifie une version FR
  useEffect(() => {
    // Ne pas traduire au chargement initial
    if (isInitialLoad) return;

    // Vérifier si une valeur a réellement changé
    const v1Changed = version1Value !== prevVersion1Ref.current;
    const v2Changed = version2Value !== prevVersion2Ref.current;
    const v3Changed = version3Value !== prevVersion3Ref.current;

    if (!v1Changed && !v2Changed && !v3Changed) return;

    // Mettre à jour les références immédiatement
    prevVersion1Ref.current = version1Value;
    prevVersion2Ref.current = version2Value;
    prevVersion3Ref.current = version3Value;

    const translateAllLanguages = async () => {
      const languagesToTranslate = availableLanguages.filter(lang => lang !== field.baseLanguage);
      
      // Créer une copie du champ avec les valeurs actuelles
      const currentField = {
        ...field,
        aiVersions: [
          { version: 1, value: version1Value, createdAt: new Date().toISOString() },
          { version: 2, value: version2Value, createdAt: new Date().toISOString() },
          { version: 3, value: version3Value, createdAt: new Date().toISOString() },
        ].filter(v => v.value && v.value.trim()),
      };
      
      let updatedField = { ...currentField };
      let hasUpdates = false;
      
      // Traduire toutes les langues pour TOUTES les versions (pas seulement celles qui ont changé)
      // Mais seulement si la valeur source existe et n'est pas vide
      const translationPromises: Array<Promise<{ lang: string; version: number; text: string } | null>> = [];
      
      for (const targetLang of languagesToTranslate) {
        for (let version = 1; version <= 3; version++) {
          const sourceValue = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
          
          // Traduire si la valeur source existe et n'est pas vide
          if (sourceValue && sourceValue.trim()) {
            const translationPromise = (async () => {
              try {
                // Traduire directement depuis la valeur source actuelle
                const translationResult = await api.translate(sourceValue, targetLang, field.baseLanguage);
                
                if (!translationResult.success) {
                  throw new Error(translationResult.error || 'Erreur lors de la traduction');
                }
                
                return {
                  lang: targetLang,
                  version: version,
                  text: translationResult.text,
                };
              } catch (error: any) {
                console.error(`Error translating ${targetLang} version ${version}:`, error);
                return null;
              }
            })();
            
            translationPromises.push(translationPromise);
          }
        }
      }

      // Attendre que toutes les traductions soient terminées
      const results = await Promise.all(translationPromises);

      // Appliquer toutes les traductions au champ
      for (const result of results) {
        if (result) {
          // Stocker la traduction automatique
          if (!autoTranslationsRef.current[result.lang]) {
            autoTranslationsRef.current[result.lang] = {};
          }
          autoTranslationsRef.current[result.lang][result.version] = result.text;
          // Utiliser une fonction pour mettre à jour de manière thread-safe
          updatedField = addTranslationToField(updatedField, result.lang, result.text, result.version);
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        // Mettre à jour le champ avec les nouvelles traductions
        onSave(updatedField);
      }
    };

    // Délai très court pour éviter trop de traductions pendant la saisie rapide
    const timeoutId = setTimeout(() => {
      translateAllLanguages();
    }, 500); // Réduit à 500ms pour une réponse plus rapide

    return () => clearTimeout(timeoutId);
  }, [version1Value, version2Value, version3Value, isInitialLoad, field.id]);

  // Auto-sauvegarde automatique
  const autoSave = () => {
    // Mettre à jour les 3 versions dans aiVersions
    const updatedAiVersions = [...(field.aiVersions || [])];
    const now = new Date().toISOString();
    
    [1, 2, 3].forEach(version => {
      const value = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
      const existingIndex = updatedAiVersions.findIndex(v => v.version === version);
      
      if (existingIndex >= 0) {
        updatedAiVersions[existingIndex] = {
          ...updatedAiVersions[existingIndex],
          value,
          createdAt: now,
        };
      } else if (value) {
        updatedAiVersions.push({
          version,
          value,
          createdAt: now,
        });
      }
    });
    
    updatedAiVersions.sort((a, b) => a.version - b.version);

    const updatedField: UserDataField = {
      ...field,
      name,
      tag,
      aiVersions: updatedAiVersions,
      updatedAt: now,
    };
    onSave(updatedField);
  };

  // Auto-sauvegarde lors des changements de name, tag ou versions
  useEffect(() => {
    if (isInitialLoad) return;
    
    const timeoutId = setTimeout(() => {
      autoSave();
    }, 1000); // Sauvegarder 1 seconde après la dernière modification

    return () => clearTimeout(timeoutId);
  }, [name, tag, version1Value, version2Value, version3Value, isInitialLoad]);


  return (
    <div className="field-editor-content">
      <div className="field-editor-form">
        <div className="form-group-inline">
          <div className="form-field-inline">
            <label>Nom du champ</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-field-inline">
            <label>Tag</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="language-versions">
        {availableLanguages.map(language => {
          // Pour la langue de base, utiliser aiVersions
          if (language === field.baseLanguage) {
            return (
              <div key={language} className="language-version-group">
                <h5 className="language-group-header">
                  {language.toUpperCase()} ({languageNames[language] || language})
                </h5>
                <div className="language-versions-row">
                  {[1, 2, 3].map(version => {
                    const value = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
                    return (
                      <div key={version} className="language-version-input-inline">
                        <label className="version-label">Version {version}</label>
                        <div className="version-input-wrapper">
                          <textarea
                            value={value}
                            onChange={(e) => {
                              if (version === 1) setVersion1Value(e.target.value);
                              else if (version === 2) setVersion2Value(e.target.value);
                              else setVersion3Value(e.target.value);
                            }}
                            rows={3}
                            placeholder={`Version ${version}`}
                          />
                          {value && (
                            <button
                              className="clear-version-button"
                              onClick={() => {
                                // Effacer la version FR
                                if (version === 1) setVersion1Value('');
                                else if (version === 2) setVersion2Value('');
                                else setVersion3Value('');
                                
                                // Effacer toutes les traductions de cette version
                                let updatedField = { ...field };
                                const languagesToClear = availableLanguages.filter(lang => lang !== field.baseLanguage);
                                languagesToClear.forEach(targetLang => {
                                  const existingIndex = updatedField.languageVersions.findIndex(
                                    v => v.language === targetLang && v.version === version
                                  );
                                  if (existingIndex >= 0) {
                                    updatedField.languageVersions.splice(existingIndex, 1);
                                  }
                                });
                                updatedField.languageVersions = [...updatedField.languageVersions];
                                onSave(updatedField);
                              }}
                              title="Effacer cette version et toutes ses traductions"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          
          // Pour les autres langues, utiliser languageVersions
          // Utiliser le champ le plus récent (celui qui vient d'être sauvegardé)
          const versions = (field.languageVersions || [])
            .filter(v => v.language === language)
            .sort((a, b) => a.version - b.version);
          
          return (
            <div key={language} className="language-version-group">
              <h5 className="language-group-header">
                {language.toUpperCase()} ({languageNames[language] || language})
              </h5>
              <div className="language-versions-row">
                {[1, 2, 3].map(version => {
                  const versionData = versions.find(v => v.version === version);
                  const currentValue = versionData?.value || '';
                  const autoTranslation = autoTranslationsRef.current[language]?.[version];
                  const isManuallyModified = autoTranslation && currentValue !== autoTranslation && currentValue !== '';
                  
                  return (
                    <div key={version} className="language-version-input-inline">
                      <div className={`version-input-wrapper ${isManuallyModified ? 'manually-modified' : ''}`}>
                        <textarea
                          value={currentValue}
                          onChange={(e) => {
                            const updatedField = addTranslationToField(field, language, e.target.value, version);
                            onSave(updatedField);
                          }}
                          rows={3}
                          placeholder={`Version ${version}`}
                        />
                        {isManuallyModified && (
                          <button
                            className="reset-translation-button"
                            onClick={async () => {
                              // Réinitialiser avec la traduction automatique
                              if (autoTranslation) {
                                const updatedField = addTranslationToField(field, language, autoTranslation, version);
                                onSave(updatedField);
                              } else {
                                // Si pas de traduction auto stockée, retraduire depuis la version FR
                                const sourceValue = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
                                if (sourceValue && sourceValue.trim()) {
                                  try {
                                    const translationResult = await api.translate(sourceValue, language, field.baseLanguage);
                                    if (translationResult.success) {
                                      const updatedField = addTranslationToField(field, language, translationResult.text, version);
                                      if (!autoTranslationsRef.current[language]) {
                                        autoTranslationsRef.current[language] = {};
                                      }
                                      autoTranslationsRef.current[language][version] = translationResult.text;
                                      onSave(updatedField);
                                    }
                                  } catch (error: any) {
                                    console.error(`Error retranslating ${language} version ${version}:`, error);
                                  }
                                }
                              }
                            }}
                            title="Réinitialiser avec la traduction automatique"
                          >
                            ↻
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

