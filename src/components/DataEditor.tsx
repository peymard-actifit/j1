import { useState, useEffect } from 'react';
import { UserDataField } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { translateField, translateAllFields, addTranslationToField } from '../utils/translation';
import './DataEditor.css';

export const DataEditor = ({ onClose }: { onClose: () => void }) => {
  const { user, setUser } = useAuth();
  const [fields, setFields] = useState<UserDataField[]>([]);
  const [selectedField, setSelectedField] = useState<UserDataField | null>(null);
  const [showAddField, setShowAddField] = useState(false);

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

  const handleAddLanguageVersion = async (fieldId: string, language: string, value?: string): Promise<void> => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    let translatedValue = value;

    // Si aucune valeur n'est fournie, traduire automatiquement depuis la langue de base
    if (!translatedValue) {
      try {
        translatedValue = await translateField(field, language);
      } catch (error: any) {
        alert(`Erreur lors de la traduction: ${error.message}`);
        return;
      }
    }

    const updatedField = addTranslationToField(field, language, translatedValue);
    await handleSaveField(updatedField);
    setSelectedField(updatedField);
  };

  const handleTranslateAllFields = async (targetLang: string) => {
    if (!user) return;

    try {
      const translations = await translateAllFields(fields, targetLang);
      
      // Mettre à jour tous les champs avec les traductions
      const updatedFields = fields.map(field => {
        const translation = translations[field.id];
        if (translation) {
          return addTranslationToField(field, targetLang, translation);
        }
        return field;
      });

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
              {fields.map(field => (
                <div
                  key={field.id}
                  className={`field-item ${selectedField?.id === field.id ? 'selected' : ''}`}
                  onClick={() => setSelectedField(field)}
                >
                  <span className="field-tag">{field.tag}</span>
                  <span className="field-name">{field.name}</span>
                  <span className="field-type">{field.type}</span>
                </div>
              ))}
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
                <div className="translate-all-section">
                  <h4>Traduction automatique</h4>
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
                      onClick={() => {
                        const select = document.getElementById('target-lang-select') as HTMLSelectElement;
                        const lang = select.value;
                        if (lang) {
                          handleTranslateAllFields(lang);
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
  onAddLanguage,
}: {
  field: UserDataField;
  onSave: (field: UserDataField) => void;
  onAddLanguage: (fieldId: string, language: string, value?: string) => Promise<void>;
}) => {
  const [name, setName] = useState(field.name);
  const [tag, setTag] = useState(field.tag);
  // Récupérer la valeur de base depuis aiVersions (version 1 par défaut)
  const [baseValue, setBaseValue] = useState(
    field.aiVersions.find(v => v.version === 1)?.value || ''
  );
  const [newLanguage, setNewLanguage] = useState('');
  const [newLanguageValue, setNewLanguageValue] = useState('');

  const handleSave = () => {
    // Mettre à jour aiVersions pour la langue de base (version 1)
    const updatedAiVersions = [...(field.aiVersions || [])];
    const existingVersion1 = updatedAiVersions.findIndex(v => v.version === 1);
    
    if (existingVersion1 >= 0) {
      updatedAiVersions[existingVersion1] = {
        ...updatedAiVersions[existingVersion1],
        value: baseValue,
        createdAt: new Date().toISOString(),
      };
    } else {
      updatedAiVersions.push({
        version: 1,
        value: baseValue,
        createdAt: new Date().toISOString(),
      });
      updatedAiVersions.sort((a, b) => a.version - b.version);
    }

    const updatedField: UserDataField = {
      ...field,
      name,
      tag,
      aiVersions: updatedAiVersions,
      updatedAt: new Date().toISOString(),
    };
    onSave(updatedField);
  };

  const handleAddLanguageClick = async () => {
    if (newLanguage) {
      await onAddLanguage(field.id, newLanguage, newLanguageValue || undefined);
      setNewLanguage('');
      setNewLanguageValue('');
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
          <label>Valeur ({field.baseLanguage})</label>
          <textarea
            value={baseValue}
            onChange={(e) => setBaseValue(e.target.value)}
            rows={4}
          />
        </div>
        <button onClick={handleSave} className="save-button">
          Enregistrer
        </button>
      </div>

      <div className="language-versions">
        <h4>Versions multilingues</h4>
        {field.languageVersions
          .filter(v => v.language !== field.baseLanguage)
          .map((version, idx) => (
            <div key={idx} className="language-version-item">
              <span className="language-tag">{version.language}</span>
              <span className="language-value">{version.value}</span>
            </div>
          ))}
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
                  await onAddLanguage(field.id, newLanguage);
                  setNewLanguage('');
                }
              }}
              className="translate-auto-button"
              title="Traduire automatiquement depuis la langue de base"
            >
              🔄 Traduire automatiquement
            </button>
          </div>
          <textarea
            placeholder="Ou saisir manuellement la valeur traduite"
            value={newLanguageValue}
            onChange={(e) => setNewLanguageValue(e.target.value)}
            rows={2}
          />
          <button
            onClick={handleAddLanguageClick}
            className="add-language-button"
            disabled={!newLanguage || (!newLanguageValue && !newLanguage)}
          >
            Ajouter la traduction
          </button>
        </div>
      </div>
    </div>
  );
};

