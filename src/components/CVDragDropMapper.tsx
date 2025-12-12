import { useState, useEffect } from 'react';
import { UserDataField } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import './CVDragDropMapper.css';

interface CVDragDropMapperProps {
  extractedData: Record<string, any>;
  userFields: UserDataField[];
  onComplete: () => void;
  onCancel: () => void;
}

interface DraggableItem {
  id: string;
  key: string;
  value: string;
  type: 'simple' | 'experience' | 'education' | 'skill' | 'language';
  index?: number; // Pour les expériences/formations
}

interface DropTarget {
  fieldId: string;
  version: 1 | 2 | 3;
  language: string;
}

export const CVDragDropMapper = ({
  extractedData,
  userFields,
  onComplete,
  onCancel,
}: CVDragDropMapperProps) => {
  const { user, setUser } = useAuth();
  const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);
  const [draggedItem, setDraggedItem] = useState<DraggableItem | null>(null);
  const [selectedField, setSelectedField] = useState<UserDataField | null>(null);
  const [filterText, setFilterText] = useState('');
  const [mappings, setMappings] = useState<Map<string, DropTarget>>(new Map());
  const [workingLanguage, setWorkingLanguage] = useState<string>(user?.baseLanguage || 'fr');

  // Convertir les données extraites en éléments draggables
  useEffect(() => {
    const items: DraggableItem[] = [];

    // Données simples
    Object.entries(extractedData).forEach(([key, value]) => {
      // Ignorer les tableaux (expériences, formations, etc.)
      if (Array.isArray(value) || typeof value === 'object' && value !== null && !value.hasOwnProperty('value')) {
        return;
      }

      let stringValue = '';
      if (typeof value === 'string') {
        stringValue = value.trim();
      } else if (value !== null && value !== undefined) {
        stringValue = String(value).trim();
      }

      if (stringValue) {
        items.push({
          id: `simple-${key}`,
          key,
          value: stringValue,
          type: 'simple',
        });
      }
    });

    // Expériences
    if (extractedData.experience && Array.isArray(extractedData.experience)) {
      extractedData.experience.forEach((exp: any, idx: number) => {
        Object.entries(exp).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim()) {
            items.push({
              id: `exp-${idx}-${key}`,
              key: `experience[${idx}].${key}`,
              value: value.trim(),
              type: 'experience',
              index: idx,
            });
          }
        });
      });
    }

    // Formations
    if (extractedData.education && Array.isArray(extractedData.education)) {
      extractedData.education.forEach((edu: any, idx: number) => {
        Object.entries(edu).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim()) {
            items.push({
              id: `edu-${idx}-${key}`,
              key: `education[${idx}].${key}`,
              value: value.trim(),
              type: 'education',
              index: idx,
            });
          }
        });
      });
    }

    // Compétences
    if (extractedData.skills && Array.isArray(extractedData.skills)) {
      extractedData.skills.forEach((skill: string, idx: number) => {
        if (skill && skill.trim()) {
          items.push({
            id: `skill-${idx}`,
            key: `skills[${idx}]`,
            value: skill.trim(),
            type: 'skill',
            index: idx,
          });
        }
      });
    }

    // Langues
    if (extractedData.languages && Array.isArray(extractedData.languages)) {
      extractedData.languages.forEach((lang: any, idx: number) => {
        if (lang.language) {
          items.push({
            id: `lang-${idx}-language`,
            key: `languages[${idx}].language`,
            value: lang.language,
            type: 'language',
            index: idx,
          });
        }
        if (lang.level) {
          items.push({
            id: `lang-${idx}-level`,
            key: `languages[${idx}].level`,
            value: lang.level,
            type: 'language',
            index: idx,
          });
        }
      });
    }

    setDraggableItems(items);
  }, [extractedData]);

  // Filtrer les champs
  const filteredFields = userFields.filter(field => {
    if (!filterText) return true;
    const search = filterText.toLowerCase();
    return (
      field.name.toLowerCase().includes(search) ||
      field.tag.toLowerCase().includes(search) ||
      field.id.toLowerCase().includes(search) ||
      field.aiVersions.some(v => v.value.toLowerCase().includes(search)) ||
      field.languageVersions.some(lv => lv.value.toLowerCase().includes(search))
    );
  });

  // Filtrer les éléments draggables
  const filteredItems = draggableItems.filter(item => {
    if (!filterText) return true;
    const search = filterText.toLowerCase();
    return (
      item.key.toLowerCase().includes(search) ||
      item.value.toLowerCase().includes(search)
    );
  });

  // Gérer le drag start
  const handleDragStart = (item: DraggableItem) => {
    setDraggedItem(item);
  };

  // Gérer le drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Gérer le drop sur une version d'un champ
  const handleDrop = (field: UserDataField, version: 1 | 2 | 3, language: string) => {
    if (!draggedItem) return;

    const mappingKey = draggedItem.id;
    const target: DropTarget = { fieldId: field.id, version, language };
    
    setMappings(prev => {
      const newMap = new Map(prev);
      newMap.set(mappingKey, target);
      return newMap;
    });

    setDraggedItem(null);
  };

  // Obtenir la valeur d'un champ pour une version et langue données
  const getFieldValue = (field: UserDataField, version: 1 | 2 | 3, language: string): string => {
    if (language === field.baseLanguage) {
      return field.aiVersions.find(v => v.version === version)?.value || '';
    } else {
      return field.languageVersions.find(
        lv => lv.language === language && lv.version === version
      )?.value || '';
    }
  };

  // Obtenir l'élément draggable mappé à un champ/version
  const getMappedItem = (field: UserDataField, version: 1 | 2 | 3, language: string): DraggableItem | null => {
    for (const [itemId, target] of mappings.entries()) {
      if (target.fieldId === field.id && target.version === version && target.language === language) {
        return draggableItems.find(item => item.id === itemId) || null;
      }
    }
    return null;
  };

  // Sauvegarder les mappings
  const handleSave = async () => {
    if (!user || !setUser) return;

    try {
      const updatedFields = [...userFields];

      mappings.forEach((target, itemId) => {
        const item = draggableItems.find(i => i.id === itemId);
        if (!item) return;

        const field = updatedFields.find(f => f.id === target.fieldId);
        if (!field) return;

        if (target.language === field.baseLanguage) {
          // Mettre à jour aiVersions
          if (!field.aiVersions) {
            field.aiVersions = [];
          }
          
          const existingVersion = field.aiVersions.find(v => v.version === target.version);
          if (existingVersion) {
            existingVersion.value = item.value;
            existingVersion.createdAt = new Date().toISOString();
          } else {
            field.aiVersions.push({
              version: target.version,
              value: item.value,
              createdAt: new Date().toISOString(),
            });
            field.aiVersions.sort((a, b) => a.version - b.version);
          }
        } else {
          // Mettre à jour languageVersions
          if (!field.languageVersions) {
            field.languageVersions = [];
          }
          
          const existingLangVersion = field.languageVersions.find(
            lv => lv.language === target.language && lv.version === target.version
          );
          if (existingLangVersion) {
            existingLangVersion.value = item.value;
            existingLangVersion.createdAt = new Date().toISOString();
          } else {
            field.languageVersions.push({
              language: target.language,
              version: target.version,
              value: item.value,
              createdAt: new Date().toISOString(),
            });
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

      const updatedUser = { ...user, data: updatedFields };
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);

      onComplete();
    } catch (error: any) {
      console.error('Error saving mappings:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const availableLanguages = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko', 'ar', 'cs', 'da', 'el', 'hu', 'id', 'nb', 'sv', 'tr', 'uk'];

  return (
    <div className="cv-drag-drop-mapper-overlay">
      <div className="cv-drag-drop-mapper">
        <div className="cv-drag-drop-mapper-header">
          <h2>Mapper les données du CV</h2>
          <button onClick={onCancel} className="close-button">✕</button>
        </div>

        <div className="cv-drag-drop-mapper-content">
          <div className="mapper-layout">
            {/* Colonne gauche : Données extraites (draggables) */}
            <div className="extracted-data-panel">
              <div className="panel-header">
                <h3>Données extraites du CV</h3>
                <input
                  type="text"
                  placeholder="Filtrer..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="filter-input"
                />
              </div>
              <div className="draggable-items-list">
                {filteredItems.length === 0 ? (
                  <p className="no-items">Aucune donnée à mapper</p>
                ) : (
                  filteredItems.map((item) => {
                    const isMapped = mappings.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`draggable-item ${isMapped ? 'mapped' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(item)}
                      >
                        <div className="drag-handle">☰</div>
                        <div className="item-content">
                          <div className="item-key">{item.key}</div>
                          <div className="item-value" title={item.value}>
                            {item.value.length > 50 ? item.value.substring(0, 50) + '...' : item.value}
                          </div>
                        </div>
                        {isMapped && <div className="mapped-badge">✓</div>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Colonne droite : Champs CV (drop targets) */}
            <div className="fields-panel">
              <div className="panel-header">
                <h3>Champs de votre CV</h3>
                <div className="language-selector">
                  <label>Langue:</label>
                  <select
                    value={workingLanguage}
                    onChange={(e) => setWorkingLanguage(e.target.value)}
                    className="lang-select"
                  >
                    {availableLanguages.map(lang => (
                      <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="fields-list">
                {filteredFields.length === 0 ? (
                  <p className="no-items">Aucun champ trouvé</p>
                ) : (
                  filteredFields.map((field) => (
                    <div
                      key={field.id}
                      className={`field-drop-target ${selectedField?.id === field.id ? 'selected' : ''}`}
                      onClick={() => setSelectedField(field)}
                    >
                      <div className="field-header">
                        <div className="field-name">{field.name}</div>
                        <div className="field-tag">{field.tag}</div>
                      </div>
                      <div className="field-versions">
                        {[1, 2, 3].map((version) => {
                          const currentValue = getFieldValue(field, version as 1 | 2 | 3, workingLanguage);
                          const mappedItem = getMappedItem(field, version as 1 | 2 | 3, workingLanguage);
                          return (
                            <div
                              key={version}
                              className={`version-drop-zone ${mappedItem ? 'has-mapping' : ''}`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDrop(field, version as 1 | 2 | 3, workingLanguage);
                              }}
                            >
                              <div className="version-label">Version {version}</div>
                              <div className="version-content">
                                {mappedItem ? (
                                  <div className="mapped-content">
                                    <div className="mapped-source">{mappedItem.key}</div>
                                    <div className="mapped-value">{mappedItem.value}</div>
                                  </div>
                                ) : (
                                  <div className="empty-version">
                                    {currentValue || 'Glisser-déposer ici'}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="cv-drag-drop-mapper-footer">
          <div className="mappings-summary">
            <strong>{mappings.size}</strong> mapping(s) créé(s)
          </div>
          <div className="footer-actions">
            <button onClick={onCancel} className="button-secondary">Annuler</button>
            <button
              onClick={handleSave}
              className="button-primary"
              disabled={mappings.size === 0}
            >
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

