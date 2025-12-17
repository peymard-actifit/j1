import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { UserDataField } from '../types/database';
import './PDFFieldsImporter.css';

interface PDFFieldsImporterProps {
  onComplete?: () => void;
  onFieldsUpdated?: (fields: UserDataField[]) => void;
  embeddedMode?: boolean;
}

interface ExtractedTag {
  tag: string;
  value: string;
  count: number;
}

interface ImportedFile {
  name: string;
  extractedTags: ExtractedTag[];
  importedAt: string;
}

export const PDFFieldsImporter = ({ onComplete, onFieldsUpdated, embeddedMode = false }: PDFFieldsImporterProps) => {
  const { user, setUser } = useAuth();
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [currentFileText, setCurrentFileText] = useState<string>('');
  const [extractedTags, setExtractedTags] = useState<ExtractedTag[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [showPreview, setShowPreview] = useState(true);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [importLog, setImportLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fonction pour extraire les tags entre accolades du texte
  const extractTagsFromText = (text: string): ExtractedTag[] => {
    // Pattern pour trouver les tags entre accolades: {TAG} ou {TAG:valeur}
    const tagPattern = /\{([^{}]+)\}/g;
    const tagsMap = new Map<string, { value: string; count: number }>();
    
    let match;
    while ((match = tagPattern.exec(text)) !== null) {
      const fullMatch = match[1];
      let tag = fullMatch;
      let value = '';
      
      // Vérifier si le tag contient une valeur séparée par :
      if (fullMatch.includes(':')) {
        const parts = fullMatch.split(':');
        tag = parts[0].trim();
        value = parts.slice(1).join(':').trim();
      }
      
      // Normaliser le tag (enlever les espaces, mettre en minuscules pour la comparaison)
      const normalizedTag = tag.trim();
      
      if (normalizedTag) {
        const existing = tagsMap.get(normalizedTag);
        if (existing) {
          existing.count++;
          // Si on a une valeur et que l'existante est vide, mettre à jour
          if (value && !existing.value) {
            existing.value = value;
          }
        } else {
          tagsMap.set(normalizedTag, { value, count: 1 });
        }
      }
    }
    
    return Array.from(tagsMap.entries()).map(([tag, data]) => ({
      tag,
      value: data.value,
      count: data.count
    }));
  };

  // Fonction pour extraire le texte d'un PDF avec pdf.js
  const extractPdfText = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      
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
      
      return fullText.trim();
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw error;
    }
  };

  // Fonction pour lire le contenu d'un fichier texte
  const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Traitement d'un fichier importé
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsProcessing(true);
    const newLogs: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingStatus(`Traitement de ${file.name} (${i + 1}/${files.length})...`);
      
      try {
        let text = '';
        
        if (file.type === 'application/pdf') {
          newLogs.push(`📄 Extraction du texte de ${file.name}...`);
          text = await extractPdfText(file);
        } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.tex')) {
          text = await readTextFile(file);
        } else {
          // Essayer de lire comme texte
          try {
            text = await readTextFile(file);
          } catch {
            newLogs.push(`⚠️ Impossible de lire ${file.name}`);
            continue;
          }
        }
        
        if (text) {
          setCurrentFileText(prev => prev + (prev ? '\n\n---\n\n' : '') + text);
          const tags = extractTagsFromText(text);
          
          newLogs.push(`✅ ${file.name}: ${tags.length} tags trouvés`);
          
          // Ajouter le fichier à la liste des fichiers importés
          setImportedFiles(prev => [...prev, {
            name: file.name,
            extractedTags: tags,
            importedAt: new Date().toISOString()
          }]);
          
          // Fusionner les nouveaux tags avec les existants
          setExtractedTags(prev => {
            const mergedMap = new Map<string, ExtractedTag>();
            
            // Ajouter les tags existants
            prev.forEach(t => mergedMap.set(t.tag.toLowerCase(), t));
            
            // Ajouter ou mettre à jour avec les nouveaux tags
            tags.forEach(newTag => {
              const key = newTag.tag.toLowerCase();
              const existing = mergedMap.get(key);
              if (existing) {
                existing.count += newTag.count;
                if (newTag.value && !existing.value) {
                  existing.value = newTag.value;
                }
              } else {
                mergedMap.set(key, { ...newTag });
              }
            });
            
            return Array.from(mergedMap.values());
          });
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        newLogs.push(`❌ Erreur pour ${file.name}: ${error}`);
      }
    }
    
    setImportLog(prev => [...prev, ...newLogs]);
    setIsProcessing(false);
    setProcessingStatus('');
    
    // Réinitialiser l'input file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fonction pour trouver la version disponible pour un champ
  const findAvailableVersion = (field: UserDataField): 1 | 2 | 3 => {
    const v1 = field.aiVersions.find(v => v.version === 1)?.value || '';
    const v2 = field.aiVersions.find(v => v.version === 2)?.value || '';
    
    if (!v1 || v1.trim() === '') return 1;
    if (!v2 || v2.trim() === '') return 2;
    return 3;
  };

  // Fonction pour créer ou mettre à jour un champ avec une valeur
  const createOrUpdateField = (
    existingFields: UserDataField[],
    tag: string,
    value: string,
    workingLanguage: string
  ): { fields: UserDataField[]; created: boolean; version: number } => {
    const now = new Date().toISOString();
    
    // Chercher un champ existant par tag (insensible à la casse)
    const existingFieldIndex = existingFields.findIndex(
      f => f.tag.toLowerCase() === tag.toLowerCase()
    );
    
    if (existingFieldIndex >= 0) {
      // Champ existant - trouver la version disponible
      const field = { ...existingFields[existingFieldIndex] };
      const version = findAvailableVersion(field);
      
      // Ajouter la valeur dans aiVersions
      const existingVersionIndex = field.aiVersions.findIndex(v => v.version === version);
      if (existingVersionIndex >= 0) {
        field.aiVersions[existingVersionIndex].value = value;
      } else {
        field.aiVersions.push({
          version,
          value,
          createdAt: now
        });
      }
      field.updatedAt = now;
      
      const updatedFields = [...existingFields];
      updatedFields[existingFieldIndex] = field;
      
      return { fields: updatedFields, created: false, version };
    } else {
      // Nouveau champ - créer avec la valeur en version 1
      const newField: UserDataField = {
        id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: formatTagAsName(tag),
        tag: tag,
        type: 'text',
        baseLanguage: workingLanguage,
        languageVersions: [],
        aiVersions: value ? [{
          version: 1,
          value,
          createdAt: now
        }] : [],
        createdAt: now,
        updatedAt: now,
      };
      
      return { fields: [...existingFields, newField], created: true, version: 1 };
    }
  };

  // Formater un tag en nom lisible
  const formatTagAsName = (tag: string): string => {
    // Séparer par les majuscules, chiffres et underscores
    let formatted = tag
      .replace(/([A-Z])/g, ' $1')
      .replace(/([0-9]+)/g, ' $1 ')
      .replace(/_/g, ' ')
      .trim();
    
    // Capitaliser la première lettre
    return formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();
  };

  // Importer les tags sélectionnés comme champs
  const handleImportSelectedTags = async () => {
    if (!user || !setUser) return;
    
    setIsProcessing(true);
    setProcessingStatus('Import des champs en cours...');
    
    const workingLanguage = user.baseLanguage || 'fr';
    let currentFields = user.data || [];
    const logs: string[] = [];
    
    // Filtrer les tags à importer
    const tagsToImport = selectedTags.size > 0 
      ? extractedTags.filter(t => selectedTags.has(t.tag))
      : extractedTags;
    
    for (const tagData of tagsToImport) {
      const result = createOrUpdateField(currentFields, tagData.tag, tagData.value, workingLanguage);
      currentFields = result.fields;
      
      if (result.created) {
        logs.push(`➕ Nouveau champ créé: ${tagData.tag}`);
      } else {
        logs.push(`📝 Champ mis à jour: ${tagData.tag} (version ${result.version})`);
      }
    }
    
    try {
      const updatedUser = { ...user, data: currentFields };
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);
      
      logs.push(`✅ ${tagsToImport.length} champs importés avec succès!`);
      
      if (onFieldsUpdated) {
        onFieldsUpdated(currentFields);
      }
    } catch (error) {
      console.error('Error saving fields:', error);
      logs.push(`❌ Erreur lors de la sauvegarde: ${error}`);
    }
    
    setImportLog(prev => [...prev, ...logs]);
    setIsProcessing(false);
    setProcessingStatus('');
  };

  // Importer uniquement les champs (sans valeurs) depuis les tags
  const handleImportFieldsOnly = async () => {
    if (!user || !setUser) return;
    
    setIsProcessing(true);
    setProcessingStatus('Création des champs vides...');
    
    const workingLanguage = user.baseLanguage || 'fr';
    let currentFields = user.data || [];
    const logs: string[] = [];
    
    const tagsToImport = selectedTags.size > 0 
      ? extractedTags.filter(t => selectedTags.has(t.tag))
      : extractedTags;
    
    for (const tagData of tagsToImport) {
      // Vérifier si le champ existe déjà
      const exists = currentFields.some(f => f.tag.toLowerCase() === tagData.tag.toLowerCase());
      
      if (!exists) {
        const result = createOrUpdateField(currentFields, tagData.tag, '', workingLanguage);
        currentFields = result.fields;
        logs.push(`➕ Nouveau champ créé: ${tagData.tag}`);
      } else {
        logs.push(`⏭️ Champ existant ignoré: ${tagData.tag}`);
      }
    }
    
    try {
      const updatedUser = { ...user, data: currentFields };
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);
      
      logs.push(`✅ Champs créés avec succès!`);
      
      if (onFieldsUpdated) {
        onFieldsUpdated(currentFields);
      }
    } catch (error) {
      console.error('Error saving fields:', error);
      logs.push(`❌ Erreur lors de la sauvegarde: ${error}`);
    }
    
    setImportLog(prev => [...prev, ...logs]);
    setIsProcessing(false);
    setProcessingStatus('');
  };

  // Sélectionner/désélectionner tous les tags
  const handleSelectAll = () => {
    if (selectedTags.size === extractedTags.length) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(extractedTags.map(t => t.tag)));
    }
  };

  // Toggle la sélection d'un tag
  const toggleTagSelection = (tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  // Réinitialiser l'import
  const handleReset = () => {
    setImportedFiles([]);
    setCurrentFileText('');
    setExtractedTags([]);
    setSelectedTags(new Set());
    setImportLog([]);
  };

  // Obtenir le statut d'un tag par rapport aux champs existants
  const getTagStatus = (tag: string): 'new' | 'exists' | 'has-value' => {
    if (!user?.data) return 'new';
    
    const existingField = user.data.find(f => f.tag.toLowerCase() === tag.toLowerCase());
    if (!existingField) return 'new';
    
    const hasValue = existingField.aiVersions.some(v => v.value && v.value.trim() !== '');
    return hasValue ? 'has-value' : 'exists';
  };

  return (
    <div className={`pdf-fields-importer ${embeddedMode ? 'embedded' : ''}`}>
      <div className="importer-header">
        <h3>📥 Import automatique de champs</h3>
        <p className="importer-description">
          Importez des PDF contenant des tags entre accolades <code>{'{TAG}'}</code> pour créer automatiquement les champs.
        </p>
      </div>

      <div className="importer-content">
        {/* Zone d'upload */}
        <div className="upload-section">
          <input
            ref={fileInputRef}
            type="file"
            id="pdf-import-input"
            accept=".pdf,.txt,.tex"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="file-input-hidden"
          />
          <label htmlFor="pdf-import-input" className="upload-button">
            📁 Choisir des fichiers (PDF, TXT, TEX)
          </label>
          
          {importedFiles.length > 0 && (
            <button onClick={handleReset} className="reset-button">
              🔄 Réinitialiser
            </button>
          )}
        </div>

        {/* Statut de traitement */}
        {isProcessing && (
          <div className="processing-status">
            <div className="spinner"></div>
            <span>{processingStatus}</span>
          </div>
        )}

        {/* Liste des fichiers importés */}
        {importedFiles.length > 0 && (
          <div className="imported-files">
            <h4>📁 Fichiers importés ({importedFiles.length})</h4>
            <div className="files-list">
              {importedFiles.map((file, idx) => (
                <div key={idx} className="imported-file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-tags-count">{file.extractedTags.length} tags</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags extraits */}
        {extractedTags.length > 0 && (
          <div className="extracted-tags-section">
            <div className="tags-header">
              <h4>🏷️ Tags trouvés ({extractedTags.length})</h4>
              <button onClick={handleSelectAll} className="select-all-button">
                {selectedTags.size === extractedTags.length ? '☐ Désélectionner tout' : '☑ Sélectionner tout'}
              </button>
            </div>
            
            <div className="tags-legend">
              <span className="legend-item new">🆕 Nouveau</span>
              <span className="legend-item exists">📝 Existant (vide)</span>
              <span className="legend-item has-value">✅ Existant (avec valeur)</span>
            </div>
            
            <div className="tags-list">
              {extractedTags.map((tagData, idx) => {
                const status = getTagStatus(tagData.tag);
                const isSelected = selectedTags.has(tagData.tag);
                
                return (
                  <div 
                    key={idx} 
                    className={`tag-item ${status} ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleTagSelection(tagData.tag)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="tag-checkbox"
                    />
                    <span className="tag-name">{tagData.tag}</span>
                    {tagData.value && (
                      <span className="tag-value" title={tagData.value}>
                        = "{tagData.value.substring(0, 30)}{tagData.value.length > 30 ? '...' : ''}"
                      </span>
                    )}
                    <span className={`tag-status ${status}`}>
                      {status === 'new' && '🆕'}
                      {status === 'exists' && '📝'}
                      {status === 'has-value' && '✅'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Actions d'import */}
            <div className="import-actions">
              <button 
                onClick={handleImportFieldsOnly} 
                className="import-button fields-only"
                disabled={isProcessing || extractedTags.length === 0}
              >
                📋 Créer les champs (sans valeurs)
              </button>
              <button 
                onClick={handleImportSelectedTags} 
                className="import-button with-values"
                disabled={isProcessing || extractedTags.length === 0}
              >
                📥 Importer avec valeurs
              </button>
            </div>
          </div>
        )}

        {/* Prévisualisation du texte */}
        {showPreview && currentFileText && (
          <div className="text-preview-section">
            <div className="preview-header">
              <h4>👁️ Aperçu du texte extrait</h4>
              <button onClick={() => setShowPreview(false)} className="hide-preview-button">
                Masquer
              </button>
            </div>
            <div className="text-preview">
              {currentFileText.split('\n').map((line, idx) => (
                <div key={idx} className="preview-line">
                  {highlightTags(line)}
                </div>
              ))}
            </div>
          </div>
        )}

        {!showPreview && currentFileText && (
          <button onClick={() => setShowPreview(true)} className="show-preview-button">
            👁️ Afficher l'aperçu
          </button>
        )}

        {/* Log d'import */}
        {importLog.length > 0 && (
          <div className="import-log">
            <h4>📜 Journal d'import</h4>
            <div className="log-content">
              {importLog.map((log, idx) => (
                <div key={idx} className="log-entry">{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {onComplete && (
        <div className="importer-footer">
          <button onClick={onComplete} className="close-button">
            Fermer
          </button>
        </div>
      )}
    </div>
  );
};

// Fonction pour mettre en surbrillance les tags dans le texte
const highlightTags = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const tagPattern = /\{([^{}]+)\}/g;
  let match;
  
  while ((match = tagPattern.exec(text)) !== null) {
    // Ajouter le texte avant le tag
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Ajouter le tag surligné
    parts.push(
      <span key={match.index} className="highlighted-tag">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  
  // Ajouter le reste du texte
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
};

export default PDFFieldsImporter;
