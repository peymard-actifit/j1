import { useState, useEffect } from 'react';
import { UserDataField } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { translateField, addTranslationToField } from '../utils/translation';
import './DataEditor.css';

export const DataEditor = ({ onClose }: { onClose: () => void }) => {
  const { user, setUser } = useAuth();
  const [fields, setFields] = useState<UserDataField[]>([]);
  const [selectedField, setSelectedField] = useState<UserDataField | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showTranslateModal, setShowTranslateModal] = useState(false);

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

  const handleAddLanguageVersion = async (fieldId: string, language: string, value?: string, version: number = 1): Promise<void> => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    let translatedValue = value;

    // Si aucune valeur n'est fournie, traduire automatiquement depuis la langue de base
    if (!translatedValue) {
      try {
        translatedValue = await translateField(field, language, version);
      } catch (error: any) {
        alert(`Erreur lors de la traduction: ${error.message}`);
        return;
      }
    }

    const updatedField = addTranslationToField(field, language, translatedValue, version);
    await handleSaveField(updatedField);
    setSelectedField(updatedField);
  };

  const handleTranslateAllFields = async (targetLang: string) => {
    if (!user) return;

    try {
      // Traduire les 3 versions pour chaque champ
      const updatedFields = await Promise.all(fields.map(async (field) => {
        let updatedField = field;
        
        // Traduire chaque version (1, 2, 3)
        for (let version = 1; version <= 3; version++) {
          const sourceValue = field.aiVersions.find(v => v.version === version)?.value;
          if (sourceValue) {
            try {
              const translated = await translateField(field, targetLang, version);
              updatedField = addTranslationToField(updatedField, targetLang, translated, version);
            } catch (error: any) {
              console.error(`Error translating version ${version} for field ${field.id}:`, error);
            }
          }
        }
        
        return updatedField;
      }));

      setFields(updatedFields);
      
      // Sauvegarder tous les champs
      if (user && setUser) {
        try {
          const updatedUser = { ...user, data: updatedFields };
          const savedUser = await storage.saveUser(updatedUser);
          setUser(savedUser);
          alert(`Traductions en ${targetLang} ajoutées avec succès !`);
        } catch (error) {
          console.error('Error saving translations:', error);
          alert('Erreur lors de la sauvegarde des traductions');
        }
      }
    } catch (error: any) {
      alert(`Erreur lors de la traduction: ${error.message}`);
    }
  };

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
            <button onClick={() => setShowTranslateModal(true)} className="translate-button">
              🌐 Traduire tous
            </button>
            <button onClick={onClose} className="close-button">
              ✕
            </button>
          </div>
        </div>

        <div className="data-editor-content">
          <div className="fields-list">
            <div className="fields-list-header">
              <h3>Champs de données</h3>
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
              {fields.map((field, index) => {
                const version1Value = field.aiVersions.find(v => v.version === 1)?.value || '';
                return (
                  <div
                    key={field.id}
                    className={`field-item ${selectedField?.id === field.id ? 'selected' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                    onClick={() => setSelectedField(field)}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="drag-handle">☰</span>
                    <div className="field-item-content">
                      <span className="field-name">{field.name}</span>
                      <span className="field-value-preview">{version1Value || '(vide)'}</span>
                      <span className="field-type">{field.type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="field-editor">
            {selectedField ? (
              <FieldEditor
                field={selectedField}
                onSave={handleSaveField}
                onAddLanguage={handleAddLanguageVersion}
              />
            ) : (
              <div className="no-field-selected">
                <p>Sélectionnez un champ pour l'éditer</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showTranslateModal && (
        <div className="translate-modal-overlay" onClick={() => setShowTranslateModal(false)}>
          <div className="translate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="translate-modal-header">
              <h3>Traduction automatique</h3>
              <button onClick={() => setShowTranslateModal(false)} className="close-button">✕</button>
            </div>
            <div className="translate-modal-content">
              <p>Traduire tous les champs vers une langue :</p>
              <div className="translate-all-controls">
                <select
                  id="target-lang-select"
                  className="lang-select"
                  defaultValue=""
                >
                  <option value="">Sélectionner une langue</option>
                  <option value="en">Anglais (en)</option>
                  <option value="es">Espagnol (es)</option>
                  <option value="de">Allemand (de)</option>
                  <option value="it">Italien (it)</option>
                  <option value="pt">Portugais (pt)</option>
                  <option value="nl">Néerlandais (nl)</option>
                  <option value="pl">Polonais (pl)</option>
                  <option value="ru">Russe (ru)</option>
                  <option value="ja">Japonais (ja)</option>
                  <option value="zh">Chinois (zh)</option>
                  <option value="ko">Coréen (ko)</option>
                </select>
                <button
                  className="translate-all-button"
                  onClick={async () => {
                    const select = document.getElementById('target-lang-select') as HTMLSelectElement;
                    const lang = select.value;
                    if (lang) {
                      await handleTranslateAllFields(lang);
                      setShowTranslateModal(false);
                    } else {
                      alert('Veuillez sélectionner une langue');
                    }
                  }}
                >
                  Traduire tous les champs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FieldEditor = ({
  field,
  onSave,
  onAddLanguage,
}: {
  field: UserDataField;
  onSave: (field: UserDataField) => void;
  onAddLanguage: (fieldId: string, language: string, value?: string, version?: number) => Promise<void>;
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
  const [newLanguage, setNewLanguage] = useState('');
  const [newLanguageVersion1, setNewLanguageVersion1] = useState('');
  const [newLanguageVersion2, setNewLanguageVersion2] = useState('');
  const [newLanguageVersion3, setNewLanguageVersion3] = useState('');

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

  const handleAddLanguageClick = async () => {
    if (newLanguage) {
      // Ajouter les 3 versions pour la nouvelle langue
      if (newLanguageVersion1) {
        await onAddLanguage(field.id, newLanguage, newLanguageVersion1, 1);
      }
      if (newLanguageVersion2) {
        await onAddLanguage(field.id, newLanguage, newLanguageVersion2, 2);
      }
      if (newLanguageVersion3) {
        await onAddLanguage(field.id, newLanguage, newLanguageVersion3, 3);
      }
      setNewLanguage('');
      setNewLanguageVersion1('');
      setNewLanguageVersion2('');
      setNewLanguageVersion3('');
    }
  };

  return (
    <div className="field-editor-content">
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
        <div className="form-group">
          <label>Version 1 ({field.baseLanguage})</label>
          <textarea
            value={version1Value}
            onChange={(e) => setVersion1Value(e.target.value)}
            rows={3}
            placeholder="Première version du texte"
          />
        </div>
        <div className="form-group">
          <label>Version 2 ({field.baseLanguage})</label>
          <textarea
            value={version2Value}
            onChange={(e) => setVersion2Value(e.target.value)}
            rows={3}
            placeholder="Deuxième version du texte"
          />
        </div>
        <div className="form-group">
          <label>Version 3 ({field.baseLanguage})</label>
          <textarea
            value={version3Value}
            onChange={(e) => setVersion3Value(e.target.value)}
            rows={3}
            placeholder="Troisième version du texte"
          />
        </div>
        <button onClick={handleSave} className="save-button">
          Enregistrer
        </button>
      </div>

      <div className="language-versions">
        <h4>Versions multilingues</h4>
        {Array.from(new Set(field.languageVersions.map(v => v.language)))
          .filter(lang => lang !== field.baseLanguage)
          .map(language => {
            const versions = field.languageVersions
              .filter(v => v.language === language)
              .sort((a, b) => a.version - b.version);
            return (
              <div key={language} className="language-version-group">
                <h5 className="language-group-header">{language.toUpperCase()}</h5>
                <div className="language-version-inputs">
                  {[1, 2, 3].map(version => {
                    const versionData = versions.find(v => v.version === version);
                    return (
                      <div key={version} className="language-version-input">
                        <label>Version {version}</label>
                        <textarea
                          value={versionData?.value || ''}
                          onChange={(e) => {
                            const updatedField = addTranslationToField(field, language, e.target.value, version);
                            onSave(updatedField);
                          }}
                          rows={2}
                          placeholder={`Version ${version} en ${language}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        <div className="add-language-form">
          <div className="language-input-group">
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              className="lang-select"
            >
              <option value="">Sélectionner une langue</option>
              <option value="en">Anglais (en)</option>
              <option value="es">Espagnol (es)</option>
              <option value="de">Allemand (de)</option>
              <option value="it">Italien (it)</option>
              <option value="pt">Portugais (pt)</option>
              <option value="nl">Néerlandais (nl)</option>
              <option value="pl">Polonais (pl)</option>
              <option value="ru">Russe (ru)</option>
              <option value="ja">Japonais (ja)</option>
              <option value="zh">Chinois (zh)</option>
              <option value="ko">Coréen (ko)</option>
            </select>
            <button
              onClick={async () => {
                if (newLanguage) {
                  // Traduire automatiquement les 3 versions
                  for (let version = 1; version <= 3; version++) {
                    const sourceValue = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
                    if (sourceValue) {
                      try {
                        const translated = await translateField(field, newLanguage, version);
                        await onAddLanguage(field.id, newLanguage, translated, version);
                      } catch (error: any) {
                        console.error(`Error translating version ${version}:`, error);
                      }
                    }
                  }
                  setNewLanguage('');
                  setNewLanguageVersion1('');
                  setNewLanguageVersion2('');
                  setNewLanguageVersion3('');
                }
              }}
              className="translate-auto-button"
              title="Traduire automatiquement les 3 versions depuis la langue de base"
            >
              🔄 Traduire automatiquement
            </button>
          </div>
          <div className="language-version-inputs">
            <div className="language-version-input">
              <label>Version 1</label>
              <textarea
                placeholder="Version 1 traduite"
                value={newLanguageVersion1}
                onChange={(e) => setNewLanguageVersion1(e.target.value)}
                rows={2}
              />
            </div>
            <div className="language-version-input">
              <label>Version 2</label>
              <textarea
                placeholder="Version 2 traduite"
                value={newLanguageVersion2}
                onChange={(e) => setNewLanguageVersion2(e.target.value)}
                rows={2}
              />
            </div>
            <div className="language-version-input">
              <label>Version 3</label>
              <textarea
                placeholder="Version 3 traduite"
                value={newLanguageVersion3}
                onChange={(e) => setNewLanguageVersion3(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <button
            onClick={handleAddLanguageClick}
            className="add-language-button"
            disabled={!newLanguage}
          >
            Ajouter les traductions
          </button>
        </div>
      </div>
    </div>
  );
};

