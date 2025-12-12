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
    }
  }, [user]);

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

  // Fonction pour compter le nombre de valeurs non vides dans un champ
  const countNonEmptyValues = (field: UserDataField): number => {
    let count = 0;
    
    // Compter les versions AI (langue de base)
    field.aiVersions?.forEach(v => {
      if (v.value && v.value.trim()) count++;
    });
    
    // Compter les versions de langue
    field.languageVersions?.forEach(lv => {
      if (lv.value && lv.value.trim()) count++;
    });
    
    return count;
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
                + Ajouter un champ
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
                  
                  const nonEmptyCount = countNonEmptyValues(field);
                  const additionalCount = nonEmptyCount > 1 ? nonEmptyCount - 1 : 0;
                  
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
                        {additionalCount > 0 && (
                          <span className="additional-values-count">({additionalCount})</span>
                        )}
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

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevVersion1Ref = useRef<string>('');
  const prevVersion2Ref = useRef<string>('');
  const prevVersion3Ref = useRef<string>('');

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
  }, [field.id]);

  // Traduire automatiquement toutes les langues quand on modifie une version FR
  useEffect(() => {
    // Ne pas traduire au chargement initial
    if (isInitialLoad) return;

    // Vérifier si une valeur a réellement changé
    const v1Changed = version1Value !== prevVersion1Ref.current;
    const v2Changed = version2Value !== prevVersion2Ref.current;
    const v3Changed = version3Value !== prevVersion3Ref.current;

    if (!v1Changed && !v2Changed && !v3Changed) return;

    // Mettre à jour les références
    prevVersion1Ref.current = version1Value;
    prevVersion2Ref.current = version2Value;
    prevVersion3Ref.current = version3Value;

    const translateAllLanguages = async () => {
      const languagesToTranslate = availableLanguages.filter(lang => lang !== field.baseLanguage);
      let updatedField = { ...field };
      let hasUpdates = false;
      
      for (const targetLang of languagesToTranslate) {
        for (let version = 1; version <= 3; version++) {
          const sourceValue = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
          const valueChanged = version === 1 ? v1Changed : version === 2 ? v2Changed : v3Changed;
          
          // Ne traduire que si la valeur a changé et n'est pas vide
          if (valueChanged && sourceValue && sourceValue.trim()) {
            try {
              // Traduire directement depuis la valeur source actuelle
              const translationResult = await api.translate(sourceValue, targetLang, field.baseLanguage);
              
              if (!translationResult.success) {
                throw new Error(translationResult.error || 'Erreur lors de la traduction');
              }
              
              const translated = translationResult.text;
              updatedField = addTranslationToField(updatedField, targetLang, translated, version);
              hasUpdates = true;
            } catch (error: any) {
              console.error(`Error translating ${targetLang} version ${version}:`, error);
            }
          }
        }
      }

      if (hasUpdates) {
        onSave(updatedField);
      }
    };

    // Délai pour éviter trop de traductions pendant la saisie
    const timeoutId = setTimeout(() => {
      translateAllLanguages();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [version1Value, version2Value, version3Value, isInitialLoad]);

  const handleSave = () => {
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


  return (
    <div className="field-editor-content">
      <div className="field-editor-header-fixed">
        <button onClick={handleSave} className="save-button">
          Enregistrer
        </button>
      </div>
      <div className="field-editor-form">
        <div className="form-group">
          <label>Nom du champ</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Tag</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>
      </div>

      <div className="language-versions">
        {availableLanguages.map(language => {
          // Pour la langue de base, utiliser aiVersions
          if (language === field.baseLanguage) {
            return (
              <div key={language} className="language-version-group">
                <h5 className="language-group-header">{language.toUpperCase()}</h5>
                <div className="language-versions-row">
                  {[1, 2, 3].map(version => {
                    const value = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
                    return (
                      <div key={version} className="language-version-input-inline">
                        <label className="version-label">Version {version}</label>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          
          // Pour les autres langues, utiliser languageVersions
          const versions = field.languageVersions
            .filter(v => v.language === language)
            .sort((a, b) => a.version - b.version);
          
          return (
            <div key={language} className="language-version-group">
              <h5 className="language-group-header">{language.toUpperCase()}</h5>
              <div className="language-versions-row">
                {[1, 2, 3].map(version => {
                  const versionData = versions.find(v => v.version === version);
                  return (
                    <div key={version} className="language-version-input-inline">
                      <label className="version-label">Version {version}</label>
                      <textarea
                        value={versionData?.value || ''}
                        onChange={(e) => {
                          const updatedField = addTranslationToField(field, language, e.target.value, version);
                          onSave(updatedField);
                        }}
                        rows={3}
                        placeholder={`Version ${version}`}
                      />
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

