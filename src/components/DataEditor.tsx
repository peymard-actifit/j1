import { useState, useEffect } from 'react';
import { UserDataField, LanguageVersion } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
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

  const handleAddLanguageVersion = (fieldId: string, language: string, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const newVersion: LanguageVersion = {
      language,
      value,
      createdAt: new Date().toISOString(),
    };

    const updatedField = {
      ...field,
      languageVersions: [...field.languageVersions, newVersion],
      updatedAt: new Date().toISOString(),
    };

    handleSaveField(updatedField);
    setSelectedField(updatedField);
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
                Sélectionnez un champ pour l'éditer
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
  onAddLanguage: (fieldId: string, language: string, value: string) => void;
}) => {
  const [name, setName] = useState(field.name);
  const [tag, setTag] = useState(field.tag);
  const [baseValue, setBaseValue] = useState(
    field.languageVersions.find(v => v.language === field.baseLanguage)?.value || ''
  );
  const [newLanguage, setNewLanguage] = useState('');
  const [newLanguageValue, setNewLanguageValue] = useState('');

  const handleSave = () => {
    const updatedField: UserDataField = {
      ...field,
      name,
      tag,
      languageVersions: [
        ...field.languageVersions.filter(v => v.language !== field.baseLanguage),
        {
          language: field.baseLanguage,
          value: baseValue,
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    onSave(updatedField);
  };

  const handleAddLanguage = () => {
    if (newLanguage && newLanguageValue) {
      onAddLanguage(field.id, newLanguage, newLanguageValue);
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
          <input
            type="text"
            placeholder="Code langue (ex: en, es)"
            value={newLanguage}
            onChange={(e) => setNewLanguage(e.target.value)}
          />
          <textarea
            placeholder="Valeur traduite"
            value={newLanguageValue}
            onChange={(e) => setNewLanguageValue(e.target.value)}
            rows={2}
          />
          <button onClick={handleAddLanguage} className="add-language-button">
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
};

