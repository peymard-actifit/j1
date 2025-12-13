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
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [showAddField, setShowAddField] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedIndices, setDraggedIndices] = useState<number[]>([]);
  const [filterText, setFilterText] = useState('');
  const [fieldsListWidth, setFieldsListWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  // Langue de travail (peut être différente de la baseLanguage de chaque champ)
  const [workingLanguage, setWorkingLanguage] = useState<string>(user?.baseLanguage || 'fr');

  // Initialiser workingLanguage une seule fois au chargement
  useEffect(() => {
    if (user && !workingLanguage) {
      setWorkingLanguage(user.baseLanguage || 'fr');
    }
  }, [user?.id]); // Seulement au chargement initial

  useEffect(() => {
    if (user) {
      setFields(user.data || []);
      // Traduire automatiquement tous les champs au chargement si les traductions n'existent pas
      translateAllFieldsOnLoad(user.data || []);
    }
  }, [user?.id, user?.data]); // Utiliser user.id et user.data au lieu de user pour éviter les re-renders inutiles

  // Fonction pour changer la langue de travail
  const handleChangeWorkingLanguage = async (newLanguage: string) => {
    if (!user || !setUser) return;
    if (newLanguage === workingLanguage) return; // Éviter les changements inutiles
    
    // Mettre à jour immédiatement le state local
    setWorkingLanguage(newLanguage);
    
    // Mettre à jour la baseLanguage de l'utilisateur
    const updatedUser = { ...user, baseLanguage: newLanguage };
    try {
      const savedUser = await storage.saveUser(updatedUser);
      // Mettre à jour le user dans le contexte, mais ne pas réinitialiser workingLanguage
      setUser(savedUser);
    } catch (error) {
      console.error('Error updating working language:', error);
      // En cas d'erreur, restaurer l'ancienne langue
      setWorkingLanguage(user.baseLanguage || 'fr');
    }
  };

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
    
    // Mettre à jour immédiatement selectedField pour que l'affichage se mette à jour instantanément
    if (selectedField?.id === field.id) {
      setSelectedField(field);
    }
    
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

  const handleFieldClick = (field: UserDataField, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Sélection par plage avec Shift
      if (selectedFields.size === 0) {
        // Si aucune sélection, commencer par ce champ
        setSelectedField(field);
        setSelectedFields(new Set([field.id]));
      } else {
        // Trouver les indices du premier champ sélectionné et du champ cliqué
        const selectedIndices = Array.from(selectedFields)
          .map(id => fields.findIndex(f => f.id === id))
          .filter(idx => idx !== -1);
        
        const clickedIndex = fields.findIndex(f => f.id === field.id);
        
        if (selectedIndices.length > 0 && clickedIndex !== -1) {
          const firstSelectedIndex = Math.min(...selectedIndices);
          const lastSelectedIndex = Math.max(...selectedIndices);
          
          // Déterminer la plage : du premier sélectionné au champ cliqué
          const startIndex = Math.min(firstSelectedIndex, clickedIndex);
          const endIndex = Math.max(lastSelectedIndex, clickedIndex);
          
          // Sélectionner tous les champs dans la plage
          const rangeFields = fields.slice(startIndex, endIndex + 1);
          const newSelected = new Set(rangeFields.map(f => f.id));
          setSelectedFields(newSelected);
          
          // Mettre à jour le champ sélectionné principal
          if (newSelected.size > 0) {
            setSelectedField(field);
          }
        }
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Sélection multiple avec Ctrl/Cmd
      const newSelected = new Set(selectedFields);
      if (newSelected.has(field.id)) {
        newSelected.delete(field.id);
      } else {
        newSelected.add(field.id);
      }
      setSelectedFields(newSelected);
      if (newSelected.size === 1) {
        setSelectedField(field);
      } else if (newSelected.size === 0) {
        setSelectedField(null);
      } else {
        setSelectedField(field);
      }
    } else {
      // Sélection simple
      setSelectedField(field);
      setSelectedFields(new Set([field.id]));
    }
  };

  const handleDragStart = (index: number, e: React.DragEvent) => {
    if (selectedFields.size > 1 && selectedFields.has(fields[index].id)) {
      // Drag en groupe
      const indices = fields
        .map((f, i) => selectedFields.has(f.id) ? i : -1)
        .filter(i => i !== -1)
        .sort((a, b) => a - b);
      setDraggedIndices(indices);
      setDraggedIndex(null);
      e.dataTransfer.effectAllowed = 'move';
    } else {
      // Drag unitaire
      setDraggedIndex(index);
      setDraggedIndices([]);
      setSelectedFields(new Set([fields[index].id]));
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndices.length > 0) {
      // Déplacement en groupe
      const targetIndex = index;
      const sourceIndices = [...draggedIndices].sort((a, b) => a - b);
      const firstSourceIndex = sourceIndices[0];
      
      if (targetIndex === firstSourceIndex || sourceIndices.includes(targetIndex)) {
        return;
      }
      
      const newFields = [...fields];
      const draggedItems = sourceIndices.map(i => newFields[i]);
      
      // Retirer les éléments de leur position actuelle (en ordre inverse pour éviter les problèmes d'index)
      for (let i = sourceIndices.length - 1; i >= 0; i--) {
        newFields.splice(sourceIndices[i], 1);
      }
      
      // Calculer la nouvelle position
      let insertIndex = targetIndex;
      for (const sourceIndex of sourceIndices) {
        if (sourceIndex < targetIndex) {
          insertIndex--;
        }
      }
      
      // Insérer les éléments à la nouvelle position
      newFields.splice(insertIndex, 0, ...draggedItems);
      setFields(newFields);
      
      // Mettre à jour les indices
      const newIndices = draggedItems.map((_, i) => insertIndex + i);
      setDraggedIndices(newIndices);
    } else if (draggedIndex !== null && draggedIndex !== index) {
      // Déplacement unitaire
      const newFields = [...fields];
      const draggedItem = newFields[draggedIndex];
      newFields.splice(draggedIndex, 1);
      newFields.splice(index, 0, draggedItem);
      setFields(newFields);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = async () => {
    if ((draggedIndex !== null || draggedIndices.length > 0) && user && setUser) {
      try {
        const updatedUser = { ...user, data: fields };
        const savedUser = await storage.saveUser(updatedUser);
        setUser(savedUser);
      } catch (error) {
        console.error('Error saving field order:', error);
      }
    }
    setDraggedIndex(null);
    setDraggedIndices([]);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleResize = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setFieldsListWidth(newWidth);
      }
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing]);

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



  const handleExport = () => {
    if (!user || !user.data || user.data.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    // Export JSON
    const jsonStr = JSON.stringify(user.data, null, 2);
    const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `cv-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
    URL.revokeObjectURL(jsonUrl);

    // Export CSV
    // Convertir les données en CSV
    const csvRows: string[] = [];
    
    // En-têtes CSV
    const headers = ['ID', 'Nom', 'Tag', 'Type', 'Langue de base', 'Version 1', 'Version 2', 'Version 3', 'Traductions'];
    csvRows.push(headers.join(','));

    // Données CSV
    user.data.forEach(field => {
      const v1 = field.aiVersions.find(v => v.version === 1)?.value || '';
      const v2 = field.aiVersions.find(v => v.version === 2)?.value || '';
      const v3 = field.aiVersions.find(v => v.version === 3)?.value || '';
      
      // Récupérer toutes les traductions
      const translations: string[] = [];
      field.languageVersions.forEach(lv => {
        translations.push(`${lv.language}-v${lv.version}:${lv.value.replace(/"/g, '""')}`);
      });
      const translationsStr = translations.join('; ');

      const row = [
        field.id,
        `"${field.name.replace(/"/g, '""')}"`,
        `"${field.tag.replace(/"/g, '""')}"`,
        field.type,
        field.baseLanguage,
        `"${v1.replace(/"/g, '""')}"`,
        `"${v2.replace(/"/g, '""')}"`,
        `"${v3.replace(/"/g, '""')}"`,
        `"${translationsStr.replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvStr = csvRows.join('\n');
    const csvBlob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement('a');
    csvLink.href = csvUrl;
    csvLink.download = `cv-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(csvLink);
    csvLink.click();
    document.body.removeChild(csvLink);
    URL.revokeObjectURL(csvUrl);
  };

  return (
    <div className="data-editor-overlay">
      <div className="data-editor">
        <div className="data-editor-header">
          <h2>Édition des données CV</h2>
          <div className="data-editor-actions">
            <button onClick={handleExport} className="export-button">
              📥 Exporter
            </button>
            <button onClick={onClose} className="close-button">
              ✕
            </button>
          </div>
        </div>

        <div className="data-editor-content">
          <div className="fields-list" style={{ width: `${fieldsListWidth}px` }}>
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
              {selectedFields.size > 1 && (
                <button 
                  onClick={() => setSelectedFields(new Set())} 
                  className="clear-selection-button"
                  title="Désélectionner"
                >
                  ✕ {selectedFields.size}
                </button>
              )}
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
                  
                  const isSelected = selectedFields.has(field.id);
                  const isDragging = draggedIndex === realIndex || draggedIndices.includes(realIndex);
                  
                  return (
                    <div
                      key={field.id}
                      className={`field-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${selectedFields.size > 1 && isSelected ? 'multi-selected' : ''}`}
                      onClick={(e) => handleFieldClick(field, e)}
                      draggable
                      onDragStart={(e) => handleDragStart(realIndex, e)}
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
          
          <div 
            className="fields-list-resizer"
            onMouseDown={handleResizeStart}
            style={{ cursor: 'col-resize' }}
          />

          <div className="field-editor">
            {selectedField ? (
              <FieldEditor
                field={selectedField}
                onSave={handleSaveField}
                workingLanguage={workingLanguage}
                onChangeWorkingLanguage={handleChangeWorkingLanguage}
                userBaseLanguage={user?.baseLanguage || 'fr'}
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

export const FieldEditor = ({
  field,
  onSave,
  workingLanguage,
  onChangeWorkingLanguage,
  userBaseLanguage,
  onDrop,
  onDragOver,
}: {
  field: UserDataField;
  onSave: (field: UserDataField) => void;
  workingLanguage: string;
  onChangeWorkingLanguage: (lang: string) => void;
  userBaseLanguage: string;
  onDrop?: (version: 1 | 2 | 3, language: string, e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
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

  // Récupérer les valeurs de la langue de travail
  // IMPORTANT: Utiliser userBaseLanguage (langue principale actuelle) au lieu de field.baseLanguage (langue originale du champ)
  const getWorkingLanguageValues = () => {
    // Si la langue de travail est la langue principale actuelle de l'utilisateur
    if (workingLanguage === userBaseLanguage) {
      // Si la langue de travail est aussi la baseLanguage originale du champ, utiliser aiVersions
      if (workingLanguage === field.baseLanguage) {
        return {
          v1: field.aiVersions.find(v => v.version === 1)?.value || '',
          v2: field.aiVersions.find(v => v.version === 2)?.value || '',
          v3: field.aiVersions.find(v => v.version === 3)?.value || '',
        };
      } else {
        // La langue de travail est la nouvelle langue principale, mais le champ a une ancienne baseLanguage
        // Chercher dans languageVersions pour la nouvelle langue principale
        const versions = field.languageVersions.filter(v => v.language === workingLanguage);
        return {
          v1: versions.find(v => v.version === 1)?.value || '',
          v2: versions.find(v => v.version === 2)?.value || '',
          v3: versions.find(v => v.version === 3)?.value || '',
        };
      }
    } else {
      // La langue de travail n'est pas la langue principale actuelle, chercher dans languageVersions
      const versions = field.languageVersions.filter(v => v.language === workingLanguage);
      return {
        v1: versions.find(v => v.version === 1)?.value || '',
        v2: versions.find(v => v.version === 2)?.value || '',
        v3: versions.find(v => v.version === 3)?.value || '',
      };
    }
  };

  // Mettre à jour les états quand le champ change ou la langue de travail change
  useEffect(() => {
    const { v1, v2, v3 } = getWorkingLanguageValues();
    
    setName(field.name);
    setTag(field.tag);
    setVersion1Value(v1);
    setVersion2Value(v2);
    setVersion3Value(v3);
    
    prevVersion1Ref.current = v1;
    prevVersion2Ref.current = v2;
    prevVersion3Ref.current = v3;
    
    // Réinitialiser autoTranslationsRef pour la langue de travail (elle ne doit jamais être marquée comme modifiée manuellement)
    // Car c'est la langue principale, pas une traduction
    if (autoTranslationsRef.current[workingLanguage]) {
      delete autoTranslationsRef.current[workingLanguage];
    }
    
    // Initialiser les traductions automatiques stockées depuis les languageVersions existantes
    // Cela permet de détecter les modifications manuelles
    // Mais seulement pour les langues secondaires (pas la langue de travail)
    field.languageVersions.forEach(lv => {
      // Ignorer la langue de travail - elle ne doit jamais être marquée comme modifiée manuellement
      if (lv.language === workingLanguage) {
        return;
      }
      
      if (!autoTranslationsRef.current[lv.language]) {
        autoTranslationsRef.current[lv.language] = {};
      }
      // IMPORTANT: Ne pas initialiser autoTranslationsRef avec les valeurs existantes
      // car on ne sait pas si elles ont été créées manuellement ou automatiquement
      // On laisse autoTranslationsRef vide au départ, et on le remplira uniquement
      // lors des traductions automatiques via translateVersion
      // Cela garantit que isManuallyModified ne sera vrai que si l'utilisateur
      // a réellement modifié manuellement après une traduction automatique
    });
    
    setIsInitialLoad(true);
    setTimeout(() => setIsInitialLoad(false), 200);
  }, [field.id, field.languageVersions.length, field.aiVersions.length, workingLanguage]); // Ajouter workingLanguage

  // Fonction pour traduire une version spécifique de la langue principale dans toutes les langues secondaires
  const translateVersion = async (version: 1 | 2 | 3) => {
    // Récupérer la valeur depuis le state local (qui est toujours à jour)
    const sourceValue = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
    
    // Vérifier que la valeur source existe et n'est pas vide
    if (!sourceValue || !sourceValue.trim() || sourceValue.length === 0) {
      return;
    }
    
    const languagesToTranslate = availableLanguages.filter(lang => lang !== workingLanguage);
    let updatedField = { ...field };
    
    // Mettre à jour le champ avec la valeur actuelle AVANT de traduire
    // Cela garantit que la valeur source est bien sauvegardée
    if (workingLanguage === field.baseLanguage) {
      const existingIndex = updatedField.aiVersions.findIndex(v => v.version === version);
      if (existingIndex >= 0) {
        updatedField.aiVersions[existingIndex].value = sourceValue;
      } else {
        updatedField.aiVersions.push({
          version: version,
          value: sourceValue,
          createdAt: new Date().toISOString()
        });
      }
    } else {
      // Si la langue de travail n'est pas la base, mettre à jour dans languageVersions
      updatedField = addTranslationToField(updatedField, workingLanguage, sourceValue, version);
    }
    
    // Traduire cette version dans toutes les langues secondaires
    const translationPromises: Array<Promise<{ lang: string; text: string } | null>> = [];
    
    for (const targetLang of languagesToTranslate) {
      // Vérifier si cette traduction a été modifiée manuellement
      // IMPORTANT: Chercher la traduction existante au bon endroit selon la langue cible
      let existingTranslation;
      if (targetLang === field.baseLanguage && targetLang !== userBaseLanguage) {
        // Si la langue cible est l'ancienne baseLanguage (mais n'est plus la langue principale actuelle), chercher dans aiVersions
        const aiVersion = updatedField.aiVersions.find(v => v.version === version);
        existingTranslation = aiVersion ? { language: targetLang, version: version, value: aiVersion.value } : null;
      } else {
        // Sinon, chercher dans languageVersions
        existingTranslation = updatedField.languageVersions.find(
          v => v.language === targetLang && v.version === version
        );
      }
      
      const storedAutoTranslation = autoTranslationsRef.current[targetLang]?.[version];
      const isManuallyModified = existingTranslation && storedAutoTranslation && 
                                 existingTranslation.value !== storedAutoTranslation;
      
      // Traduire seulement si la traduction n'a pas été modifiée manuellement
      if (!isManuallyModified) {
        const translationPromise = (async () => {
          try {
            // Traduire depuis workingLanguage vers targetLang
            const translationResult = await api.translate(sourceValue, targetLang, workingLanguage);
            
            if (!translationResult.success) {
              throw new Error(translationResult.error || 'Erreur lors de la traduction');
            }
            
            return {
              lang: targetLang,
              text: translationResult.text,
            };
          } catch (error: any) {
            console.error(`Error translating ${targetLang} version ${version} from ${workingLanguage}:`, error);
            return null;
          }
        })();
        
        translationPromises.push(translationPromise);
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
        autoTranslationsRef.current[result.lang][version] = result.text;
        
        // Si la langue cible est l'ancienne baseLanguage (et que ce n'est plus la langue principale actuelle),
        // mettre à jour aiVersions au lieu de languageVersions
        if (result.lang === field.baseLanguage && workingLanguage !== field.baseLanguage && result.lang !== userBaseLanguage) {
          const existingIndex = updatedField.aiVersions.findIndex(v => v.version === version);
          if (existingIndex >= 0) {
            updatedField.aiVersions[existingIndex].value = result.text;
          } else {
            updatedField.aiVersions.push({
              version: version,
              value: result.text,
              createdAt: new Date().toISOString()
            });
          }
        } else {
          // Sinon, utiliser addTranslationToField normalement
          updatedField = addTranslationToField(updatedField, result.lang, result.text, version);
        }
      }
    }
    
    // Sauvegarder le champ mis à jour
    await onSave(updatedField);
  };

  // Fonction pour effacer une version de la langue principale et toutes ses traductions
  const clearVersion = async (version: 1 | 2 | 3) => {
    // Effacer la version dans le state IMMÉDIATEMENT pour que le champ se vide visuellement
    if (version === 1) {
      setVersion1Value('');
      prevVersion1Ref.current = '';
    } else if (version === 2) {
      setVersion2Value('');
      prevVersion2Ref.current = '';
    } else {
      setVersion3Value('');
      prevVersion3Ref.current = '';
    }
    
    // Effacer toutes les traductions de cette version pour TOUTES les langues
    let updatedField = { ...field };
    
    // Retirer de aiVersions si la version existe et que la baseLanguage originale est la langue de travail
    if (workingLanguage === field.baseLanguage && workingLanguage === userBaseLanguage) {
      updatedField.aiVersions = updatedField.aiVersions.filter(v => v.version !== version);
    }

    // Retirer de languageVersions pour la langue de travail
    updatedField.languageVersions = updatedField.languageVersions.filter(
      v => !(v.language === workingLanguage && v.version === version)
    );
    
    // Effacer toutes les traductions de cette version dans TOUTES les langues (y compris l'ancienne langue principale)
    availableLanguages.forEach(targetLang => {
      // Si c'est la langue de travail, on l'a déjà fait
      if (targetLang === workingLanguage) {
        return;
      }
      
      // Si c'est la baseLanguage originale et que c'est aussi la langue principale actuelle, on l'a déjà fait dans aiVersions
      if (targetLang === field.baseLanguage && targetLang === userBaseLanguage) {
        return;
      }
      
      // Si c'est l'ancienne baseLanguage (mais n'est plus la langue principale actuelle), retirer de aiVersions
      if (targetLang === field.baseLanguage && targetLang !== userBaseLanguage) {
        updatedField.aiVersions = updatedField.aiVersions.filter(v => v.version !== version);
      }
      
      // Effacer dans languageVersions
      const existingIndex = updatedField.languageVersions.findIndex(
        v => v.language === targetLang && v.version === version
      );
      if (existingIndex >= 0) {
        updatedField.languageVersions.splice(existingIndex, 1);
      }
      
      // Effacer aussi la traduction auto stockée
      if (autoTranslationsRef.current[targetLang]) {
        delete autoTranslationsRef.current[targetLang][version];
      }
    });
    
    updatedField.languageVersions = [...updatedField.languageVersions];
    updatedField.updatedAt = new Date().toISOString();
    await onSave(updatedField);
  };

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

    let updatedField: UserDataField = {
      ...field,
      name,
      tag,
      aiVersions: updatedAiVersions,
      updatedAt: now,
    };
    
    // Si la langue de travail n'est pas la langue de base originale du champ, mettre à jour aussi languageVersions
    // Mais si c'est la langue principale actuelle et que c'est aussi la baseLanguage originale, on l'a déjà fait dans aiVersions
    if (workingLanguage !== field.baseLanguage || (workingLanguage === userBaseLanguage && workingLanguage !== field.baseLanguage)) {
      [1, 2, 3].forEach(version => {
        const value = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
        updatedField = addTranslationToField(updatedField, workingLanguage, value, version);
      });
    }
    
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
      <div className="field-editor-header-sticky">
        <div className="form-field-inline-compact">
          <label>Nom du champ</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-field-inline-compact">
          <label>Tag</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>
      </div>

      <div className="language-versions-grid">
        {/* Afficher d'abord la langue de travail */}
        {(() => {
          const language = workingLanguage;
          // Pour la langue de travail, utiliser aiVersions si c'est la langue de base originale ET la langue principale actuelle
          // Sinon, utiliser languageVersions
          if (language === field.baseLanguage && language === userBaseLanguage) {
            return (
              <div key={language} className="language-version-row">
                <div 
                  className="language-label clickable-language-label"
                  onDoubleClick={() => onChangeWorkingLanguage(language)}
                  title="Double-clic pour changer la langue de travail"
                >
                  {language.toUpperCase()} ({languageNames[language] || language})
                </div>
                <div className="language-versions-row">
                  {[1, 2, 3].map(version => {
                    const value = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
                    return (
                      <div key={version} className="language-version-input-inline">
                        <div className="version-label-with-buttons">
                          <label className="version-label">Version {version}</label>
                          <div className="version-buttons">
                            <button
                              className="translate-version-button"
                              onClick={() => translateVersion(version as 1 | 2 | 3)}
                              title="Traduire cette version dans toutes les langues"
                            >
                              🌐
                            </button>
                            <button
                              className="clear-version-button"
                              onClick={() => clearVersion(version as 1 | 2 | 3)}
                              title="Effacer cette version et toutes ses traductions dans toutes les langues"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <div 
                          className="version-input-wrapper"
                          onDragOver={onDragOver}
                          onDrop={onDrop ? (e) => onDrop(version as 1 | 2 | 3, language, e) : undefined}
                        >
                          <textarea
                            value={value}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              // Mettre à jour immédiatement le state pour l'affichage
                              if (version === 1) setVersion1Value(newValue);
                              else if (version === 2) setVersion2Value(newValue);
                              else setVersion3Value(newValue);
                            }}
                            rows={2}
                            placeholder={`Version ${version}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          } else {
            // Si la langue de travail n'est pas la langue de base, utiliser languageVersions
            const versions = (field.languageVersions || [])
              .filter(v => v.language === language)
              .sort((a, b) => a.version - b.version);
            
            return (
              <div key={language} className="language-version-row">
                <div 
                  className="language-label clickable-language-label"
                  onDoubleClick={() => onChangeWorkingLanguage(language)}
                  title="Double-clic pour changer la langue de travail"
                >
                  {language.toUpperCase()} ({languageNames[language] || language})
                </div>
                <div className="language-versions-row">
                  {[1, 2, 3].map(version => {
                    const versionData = versions.find(v => v.version === version);
                    const currentValue = versionData?.value || '';
                    // La langue de travail ne doit jamais être marquée comme modifiée manuellement
                    // Car c'est la langue principale, pas une traduction
                    const isWorkingLanguage = language === workingLanguage;
                    const autoTranslation = isWorkingLanguage ? undefined : autoTranslationsRef.current[language]?.[version];
                    // Une traduction est manuellement modifiée si :
                    // - Ce n'est PAS la langue de travail
                    // - La valeur actuelle existe et n'est pas vide
                    // - Il y a une traduction auto stockée
                    // - La valeur actuelle est différente de la traduction auto stockée
                    const isManuallyModified = !isWorkingLanguage && currentValue !== '' && autoTranslation !== undefined && currentValue !== autoTranslation;
                    
                    return (
                      <div key={version} className="language-version-input-inline">
                        <div className="version-label-with-buttons">
                          <label className="version-label">Version {version}</label>
                          {isManuallyModified && (
                            <button
                              className="reset-translation-button"
                              onClick={async () => {
                                // Réinitialiser à la traduction automatique
                                if (autoTranslation) {
                                  const updatedField = addTranslationToField(field, language, autoTranslation, version);
                                  await onSave(updatedField);
                                }
                              }}
                              title="Réinitialiser à la traduction automatique"
                            >
                              ↻
                            </button>
                          )}
                        </div>
                        <div 
                          className={`version-input-wrapper ${isManuallyModified ? 'manually-modified' : ''}`}
                          onDragOver={onDragOver}
                          onDrop={onDrop ? (e) => onDrop(version as 1 | 2 | 3, language, e) : undefined}
                        >
                          <textarea
                            value={currentValue}
                            onChange={async (e) => {
                              const newValue = e.target.value;
                              // Mettre à jour le state local pour l'affichage immédiat
                              if (version === 1) setVersion1Value(newValue);
                              else if (version === 2) setVersion2Value(newValue);
                              else setVersion3Value(newValue);
                              
                              // Sauvegarder immédiatement dans la base de données
                              const updatedField = addTranslationToField(field, language, newValue, version);
                              
                              // Gérer les traductions automatiques
                              if (autoTranslation && newValue !== autoTranslation) {
                                // Modification manuelle, garder la traduction auto pour réinitialisation
                              } else if (!autoTranslation && newValue) {
                                if (!autoTranslationsRef.current[language]) {
                                  autoTranslationsRef.current[language] = {};
                                }
                                autoTranslationsRef.current[language][version] = newValue;
                              } else if (newValue === '' && autoTranslation) {
                                if (autoTranslationsRef.current[language]) {
                                  delete autoTranslationsRef.current[language][version];
                                }
                              }
                              
                              await onSave(updatedField);
                            }}
                            rows={2}
                            placeholder={`Version ${version}`}
                          />
                          <div className="version-buttons">
                            <button
                              className="translate-version-button"
                              onClick={() => translateVersion(version as 1 | 2 | 3)}
                              title="Traduire cette version dans toutes les langues"
                            >
                              🌐
                            </button>
                            <button
                              className="clear-version-button"
                              onClick={() => clearVersion(version as 1 | 2 | 3)}
                              title="Effacer cette version et toutes ses traductions dans toutes les langues"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
        })()}
        
        {/* Afficher ensuite toutes les autres langues */}
        {availableLanguages
          .filter(lang => lang !== workingLanguage)
          .map(language => {
            // Pour la langue de base, utiliser aiVersions
            if (language === field.baseLanguage) {
              const versions = field.aiVersions;
              return (
                <div key={language} className="language-version-row">
                  <div 
                    className="language-label clickable-language-label"
                    onDoubleClick={() => onChangeWorkingLanguage(language)}
                    title="Double-clic pour changer la langue de travail"
                  >
                    {language.toUpperCase()} ({languageNames[language] || language})
                  </div>
                  <div className="language-versions-row">
                    {[1, 2, 3].map(version => {
                      const versionData = versions.find(v => v.version === version);
                      const currentValue = versionData?.value || '';
                      const autoTranslation = autoTranslationsRef.current[language]?.[version];
                      // Une traduction est manuellement modifiée si :
                      // - Ce n'est PAS la langue de travail (langue principale)
                      // - La valeur actuelle existe et n'est pas vide
                      // - Il y a une traduction auto stockée (donc une traduction automatique a été faite)
                      // - La valeur actuelle est différente de la traduction auto stockée
                      const isWorkingLanguage = language === workingLanguage;
                      const isManuallyModified = !isWorkingLanguage && 
                                                 currentValue !== '' && 
                                                 autoTranslation !== undefined && 
                                                 currentValue !== autoTranslation;
                      
                      return (
                        <div key={version} className="language-version-input-inline">
                          <div className="version-label-with-buttons">
                            <label className="version-label">Version {version}</label>
                            {isManuallyModified && (
                              <button
                                className="reset-translation-button"
                                onClick={async () => {
                                  if (autoTranslation) {
                                    const updatedField = addTranslationToField(field, language, autoTranslation, version);
                                    await onSave(updatedField);
                                  }
                                }}
                                title="Réinitialiser avec la traduction automatique"
                              >
                                ↻
                              </button>
                            )}
                          </div>
                          <div 
                            className={`version-input-wrapper ${isManuallyModified ? 'manually-modified' : ''}`}
                            onDragOver={onDragOver}
                            onDrop={onDrop ? (e) => onDrop(version as 1 | 2 | 3, language, e) : undefined}
                          >
                            <textarea
                              value={currentValue}
                              onChange={async (e) => {
                                const newValue = e.target.value;
                                const updatedField = addTranslationToField(field, language, newValue, version);
                                await onSave(updatedField);
                              }}
                              rows={2}
                              placeholder={`Version ${version}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            
            // Pour les autres langues, utiliser languageVersions
            const versions = (field.languageVersions || [])
              .filter(v => v.language === language)
              .sort((a, b) => a.version - b.version);
            
            return (
              <div key={language} className="language-version-row">
                <div 
                  className="language-label clickable-language-label"
                  onDoubleClick={() => onChangeWorkingLanguage(language)}
                  title="Double-clic pour changer la langue de travail"
                >
                  {language.toUpperCase()} ({languageNames[language] || language})
                </div>
                <div className="language-versions-row">
                  {[1, 2, 3].map(version => {
                    const versionData = versions.find(v => v.version === version);
                    const currentValue = versionData?.value || '';
                    // La langue de travail ne doit jamais être marquée comme modifiée manuellement
                    // Car c'est la langue principale, pas une traduction
                    const isWorkingLanguage = language === workingLanguage;
                    const autoTranslation = isWorkingLanguage ? undefined : autoTranslationsRef.current[language]?.[version];
                    // Une traduction est manuellement modifiée si :
                    // - Ce n'est PAS la langue de travail
                    // - La valeur actuelle existe et n'est pas vide
                    // - Il y a une traduction auto stockée
                    // - La valeur actuelle est différente de la traduction auto stockée
                    const isManuallyModified = !isWorkingLanguage && currentValue !== '' && autoTranslation !== undefined && currentValue !== autoTranslation;
                    
                    return (
                      <div key={version} className="language-version-input-inline">
                        <div className={`version-input-wrapper ${isManuallyModified ? 'manually-modified' : ''}`}>
                          <textarea
                            value={currentValue}
                            onChange={async (e) => {
                              const newValue = e.target.value;
                              const updatedField = addTranslationToField(field, language, newValue, version);
                              
                              // Si l'utilisateur modifie manuellement le texte, ne pas mettre à jour autoTranslationsRef
                              // Cela permet de détecter que c'est une modification manuelle
                              // Seulement si la valeur correspond exactement à la traduction auto, on la met à jour
                              if (autoTranslation && newValue === autoTranslation) {
                                // La valeur correspond à la traduction auto, tout va bien
                              } else if (autoTranslation && newValue !== autoTranslation) {
                                // Modification manuelle détectée - NE PAS mettre à jour autoTranslationsRef
                                // Cela permet au fond violet de s'afficher
                              } else if (!autoTranslation && newValue) {
                                // Nouvelle valeur sans traduction auto existante
                                // Ne pas la stocker comme auto-translation car c'est une modification manuelle
                              } else if (newValue === '' && autoTranslation) {
                                // Champ vidé, supprimer la traduction auto
                                if (autoTranslationsRef.current[language]) {
                                  delete autoTranslationsRef.current[language][version];
                                }
                              }
                              
                              await onSave(updatedField);
                            }}
                            rows={2}
                            placeholder={`Version ${version}`}
                          />
                          {isManuallyModified && (
                            <button
                              className="reset-translation-button"
                              onClick={async () => {
                                if (autoTranslation) {
                                  const updatedField = addTranslationToField(field, language, autoTranslation, version);
                                  await onSave(updatedField);
                                } else {
                                  const sourceValue = version === 1 ? version1Value : version === 2 ? version2Value : version3Value;
                                  if (sourceValue && sourceValue.trim()) {
                                    try {
                                      const translationResult = await api.translate(sourceValue, language, workingLanguage);
                                      if (translationResult.success) {
                                        const updatedField = addTranslationToField(field, language, translationResult.text, version);
                                        if (!autoTranslationsRef.current[language]) {
                                          autoTranslationsRef.current[language] = {};
                                        }
                                        autoTranslationsRef.current[language][version] = translationResult.text;
                                        await onSave(updatedField);
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

