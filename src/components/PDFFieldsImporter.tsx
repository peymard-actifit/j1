import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { api } from '../utils/api';
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
  confidence?: number;
  isNew?: boolean;
  source?: string;
}

interface ExtractedImage {
  description: string;
  type: 'photo' | 'logo' | 'chart' | 'timeline' | 'icon' | 'other';
  suggestedTag?: string;
  base64?: string;
}

interface ImportedFile {
  name: string;
  extractedTags: ExtractedTag[];
  extractedImages?: ExtractedImage[];
  importedAt: string;
  mode: 'template' | 'cv';
}

type ImportMode = 'template' | 'cv-ai';
type AIProvider = 'combined' | 'affinda' | 'openai';

export const PDFFieldsImporter = ({ onComplete, onFieldsUpdated, embeddedMode = false }: PDFFieldsImporterProps) => {
  const { user, setUser } = useAuth();
  const [importMode, setImportMode] = useState<ImportMode>('cv-ai');
  const [aiProvider, setAiProvider] = useState<AIProvider>('combined');
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [currentFileText, setCurrentFileText] = useState<string>('');
  const [currentFileImage, setCurrentFileImage] = useState<string>('');
  const [extractedTags, setExtractedTags] = useState<ExtractedTag[]>([]);
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [showPreview, setShowPreview] = useState(true);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [importLog, setImportLog] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fonction pour extraire les tags entre accolades du texte (mode template)
  const extractTagsFromText = (text: string): ExtractedTag[] => {
    const tagPattern = /\{([^{}]+)\}/g;
    const tagsMap = new Map<string, { value: string; count: number }>();
    
    let match;
    while ((match = tagPattern.exec(text)) !== null) {
      const fullMatch = match[1];
      let tag = fullMatch;
      let value = '';
      
      if (fullMatch.includes(':')) {
        const parts = fullMatch.split(':');
        tag = parts[0].trim();
        value = parts.slice(1).join(':').trim();
      }
      
      const normalizedTag = tag.trim();
      
      if (normalizedTag) {
        const existing = tagsMap.get(normalizedTag);
        if (existing) {
          existing.count++;
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
      count: data.count,
      isNew: false
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

  // Fonction pour convertir un PDF en image (première page)
  const convertPdfToImage = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Rendre toutes les pages en images et les combiner
      const images: string[] = [];
      const maxPages = Math.min(pdf.numPages, 5); // Limiter à 5 pages max
      
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 2; // Haute résolution
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        } as any).promise;
        
        images.push(canvas.toDataURL('image/png'));
      }
      
      // Retourner la première page pour l'analyse (ou combiner si nécessaire)
      return images[0] || '';
    } catch (error) {
      console.error('Error converting PDF to image:', error);
      return '';
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

  // Fonction pour lire un fichier image en base64
  const readImageAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Traitement d'un fichier en mode template (extraction de tags)
  const processTemplateFile = async (file: File, newLogs: string[]): Promise<ExtractedTag[]> => {
    let text = '';
    
    if (file.type === 'application/pdf') {
      newLogs.push(`📄 Extraction du texte de ${file.name}...`);
      text = await extractPdfText(file);
    } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.tex')) {
      text = await readTextFile(file);
    } else {
      text = await readTextFile(file);
    }
    
    if (text) {
      setCurrentFileText(prev => prev + (prev ? '\n\n---\n\n' : '') + text);
      const tags = extractTagsFromText(text);
      newLogs.push(`✅ ${file.name}: ${tags.length} tags trouvés`);
      return tags;
    }
    
    return [];
  };

  // Convertir un fichier en base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Traitement d'un fichier en mode CV avec IA
  const processCVFileWithAI = async (file: File, newLogs: string[]): Promise<{ tags: ExtractedTag[], images: ExtractedImage[] }> => {
    const providerName = aiProvider === 'combined' ? 'Affinda + OpenAI' : aiProvider === 'affinda' ? 'Affinda' : 'OpenAI';
    newLogs.push(`🤖 Analyse ${providerName} de ${file.name}...`);
    setProcessingStatus(`🤖 Analyse ${providerName} de ${file.name}...`);
    
    let textContent = '';
    let imageBase64 = '';
    let fileBase64 = '';
    
    // Extraire le texte et l'image du PDF
    if (file.type === 'application/pdf') {
      newLogs.push(`📄 Extraction du texte et des images...`);
      setProcessingStatus(`📄 Extraction du texte et des images de ${file.name}...`);
      
      // Obtenir le fichier en base64 pour Affinda
      fileBase64 = await fileToBase64(file);
      
      textContent = await extractPdfText(file);
      imageBase64 = await convertPdfToImage(file);
      
      setCurrentFileText(prev => prev + (prev ? '\n\n---\n\n' : '') + textContent);
      if (imageBase64) {
        setCurrentFileImage(imageBase64);
      }
    } else if (file.type.startsWith('image/')) {
      imageBase64 = await readImageAsBase64(file);
      fileBase64 = imageBase64;
      setCurrentFileImage(imageBase64);
    } else {
      textContent = await readTextFile(file);
      setCurrentFileText(prev => prev + (prev ? '\n\n---\n\n' : '') + textContent);
    }
    
    // Préparer les champs existants pour l'IA
    const existingFields = (user?.data || []).map(f => ({
      id: f.id,
      name: f.name,
      tag: f.tag,
      type: f.type
    }));
    
    newLogs.push(`🧠 Envoi à ${providerName} pour analyse approfondie...`);
    setProcessingStatus(`🧠 Analyse approfondie par ${providerName} de ${file.name}...`);
    
    // Utiliser la méthode appropriée selon le provider sélectionné
    if (aiProvider === 'combined') {
      // Mode combiné: Affinda + OpenAI pour les meilleurs résultats
      const result = await api.analyzeCVCombined({
        fileBase64,
        fileName: file.name,
        textContent,
        imageBase64: imageBase64 || undefined,
        existingFields,
        workingLanguage: user?.baseLanguage || 'fr',
        useAffinda: true,
        useOpenAI: true
      });
      
      if (result.success) {
        const tags: ExtractedTag[] = result.extractedData.map(d => ({
          tag: d.tag,
          value: d.value,
          count: 1,
          confidence: d.confidence,
          isNew: d.isNew,
          source: d.source
        }));
        
        const sources: string[] = [];
        if (result.affindaUsed) sources.push('Affinda');
        if (result.openaiUsed) sources.push('OpenAI');
        
        newLogs.push(`✅ ${file.name}: ${tags.length} données extraites via ${sources.join(' + ')}`);
        
        if (result.summary) {
          setAiSummary(result.summary);
          newLogs.push(`📊 Résumé: ${result.summary.substring(0, 100)}...`);
        }
        
        if (result.suggestions && result.suggestions.length > 0) {
          setAiSuggestions(result.suggestions);
        }
        
        // Afficher les métriques si disponibles
        if (result.metrics?.total?.duration) {
          newLogs.push(`⏱️ Durée totale: ${result.metrics.total.duration}ms`);
        }
        
        return { tags, images: result.images || [] };
      } else {
        const errorMsg = result.error?.message || 'Erreur inconnue';
        newLogs.push(`⚠️ Erreur: ${errorMsg}`);
        return { tags: [], images: [] };
      }
    } else if (aiProvider === 'affinda') {
      // Mode Affinda uniquement
      const result = await api.parseCVWithAffinda({
        fileBase64,
        fileName: file.name,
        textContent
      });
      
      if (result.success) {
        const tags: ExtractedTag[] = result.extractedData.map(d => ({
          tag: d.tag,
          value: d.value,
          count: 1,
          confidence: d.confidence,
          isNew: d.isNew
        }));
        
        newLogs.push(`✅ ${file.name}: ${tags.length} données extraites par Affinda`);
        
        if (result.summary) {
          setAiSummary(result.summary);
          newLogs.push(`📊 Résumé: ${result.summary}`);
        }
        
        // Afficher les métriques Affinda
        if (result.metrics?.duration) {
          newLogs.push(`⏱️ Durée: ${result.metrics.duration}ms`);
        }
        if (result.isResumeProbability !== undefined) {
          newLogs.push(`🎯 Confiance CV: ${Math.round(result.isResumeProbability * 100)}%`);
        }
        
        return { tags, images: [] };
      } else {
        const errorMsg = result.error?.message || 'Erreur inconnue';
        newLogs.push(`⚠️ Erreur Affinda: ${errorMsg}`);
        return { tags: [], images: [] };
      }
    } else {
      // Mode OpenAI uniquement
      const result = await api.analyzeCVWithAI({
        textContent,
        imageBase64: imageBase64 || undefined,
        existingFields,
        workingLanguage: user?.baseLanguage || 'fr',
        extractImages: true
      });
      
      if (result.success) {
        const tags: ExtractedTag[] = result.extractedData.map(d => ({
          tag: d.tag,
          value: d.value,
          count: 1,
          confidence: d.confidence,
          isNew: d.isNew
        }));
        
        newLogs.push(`✅ ${file.name}: ${tags.length} données extraites par OpenAI`);
        
        if (result.summary) {
          setAiSummary(result.summary);
          newLogs.push(`📊 Résumé: ${result.summary.substring(0, 100)}...`);
        }
        
        if (result.suggestions && result.suggestions.length > 0) {
          setAiSuggestions(result.suggestions);
        }
        
        // Afficher les métriques OpenAI
        if (result.metrics) {
          const metricsLog: string[] = [];
          if (result.metrics.tokensUsed) metricsLog.push(`${result.metrics.tokensUsed} tokens`);
          if (result.metrics.duration) metricsLog.push(`${result.metrics.duration}ms`);
          if (result.metrics.model) metricsLog.push(result.metrics.model);
          if (metricsLog.length > 0) {
            newLogs.push(`💰 ${metricsLog.join(' | ')}`);
          }
        }
        
        if (result.detectedLanguage) {
          newLogs.push(`🌐 Langue détectée: ${result.detectedLanguage.toUpperCase()}`);
        }
        
        return { tags, images: result.images || [] };
      } else {
        const errorMsg = result.error?.message || 'Erreur inconnue';
        newLogs.push(`⚠️ Erreur OpenAI: ${errorMsg}`);
        return { tags: [], images: [] };
      }
    }
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
        let tags: ExtractedTag[] = [];
        let images: ExtractedImage[] = [];
        
        if (importMode === 'template') {
          tags = await processTemplateFile(file, newLogs);
        } else {
          const result = await processCVFileWithAI(file, newLogs);
          tags = result.tags;
          images = result.images;
        }
        
        if (tags.length > 0 || images.length > 0) {
          // Ajouter le fichier à la liste des fichiers importés
          setImportedFiles(prev => [...prev, {
            name: file.name,
            extractedTags: tags,
            extractedImages: images,
            importedAt: new Date().toISOString(),
            mode: importMode === 'template' ? 'template' : 'cv'
          }]);
          
          // Fusionner les nouveaux tags avec les existants
          setExtractedTags(prev => {
            const mergedMap = new Map<string, ExtractedTag>();
            
            prev.forEach(t => mergedMap.set(t.tag.toLowerCase(), t));
            
            tags.forEach(newTag => {
              const key = newTag.tag.toLowerCase();
              const existing = mergedMap.get(key);
              if (existing) {
                existing.count += newTag.count;
                if (newTag.value && !existing.value) {
                  existing.value = newTag.value;
                }
                if (newTag.confidence && (!existing.confidence || newTag.confidence > existing.confidence)) {
                  existing.confidence = newTag.confidence;
                }
              } else {
                mergedMap.set(key, { ...newTag });
              }
            });
            
            return Array.from(mergedMap.values());
          });
          
          // Fusionner les images
          if (images.length > 0) {
            setExtractedImages(prev => [...prev, ...images]);
          }
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        newLogs.push(`❌ Erreur pour ${file.name}: ${error}`);
      }
    }
    
    setImportLog(prev => [...prev, ...newLogs]);
    setIsProcessing(false);
    setProcessingStatus('');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fonction pour trouver la version disponible pour un champ
  // Logique : Version 1 d'abord, puis 2, puis 3 (écrase la 3 si toutes remplies)
  const findAvailableVersion = (field: UserDataField): 1 | 2 | 3 => {
    const versions = field.aiVersions || [];
    const v1 = versions.find(v => v.version === 1)?.value || '';
    const v2 = versions.find(v => v.version === 2)?.value || '';
    
    // Premier CV : version 1
    if (!v1 || v1.trim() === '') return 1;
    // Deuxième CV : version 2
    if (!v2 || v2.trim() === '') return 2;
    // Troisième CV et suivants : version 3 (écrase si déjà remplie)
    return 3;
  };

  // Fonction pour créer ou mettre à jour un champ avec une valeur
  // - Nouveau champ : crée avec version 1
  // - Champ existant : remplit version 1, puis 2, puis écrase 3
  // - allowEmpty: permet de créer des champs sans valeur (pour import structure seule)
  const createOrUpdateField = (
    existingFields: UserDataField[],
    tag: string,
    value: string,
    workingLanguage: string,
    fieldType: string = 'text',
    allowEmpty: boolean = false
  ): { fields: UserDataField[]; created: boolean; version: number; replaced: boolean } => {
    const now = new Date().toISOString();
    const hasValue = value && value.trim();
    
    // Ne pas traiter si valeur vide et allowEmpty=false
    if (!hasValue && !allowEmpty) {
      return { fields: existingFields, created: false, version: 0, replaced: false };
    }
    
    const existingFieldIndex = existingFields.findIndex(
      f => f.tag && f.tag.toLowerCase() === tag.toLowerCase()
    );
    
    if (existingFieldIndex >= 0) {
      // Copie profonde du champ existant
      const originalField = existingFields[existingFieldIndex];
      const field: UserDataField = { 
        ...originalField,
        aiVersions: originalField.aiVersions ? [...originalField.aiVersions.map(v => ({...v}))] : [],
        languageVersions: originalField.languageVersions ? [...originalField.languageVersions.map(v => ({...v}))] : []
      };
      
      const version = findAvailableVersion(field);
      const existingVersionIndex = field.aiVersions.findIndex(v => v.version === version);
      const isReplacing = existingVersionIndex >= 0 && version === 3;
      
      if (existingVersionIndex >= 0) {
        // Mettre à jour la version existante (écrase si version 3 déjà remplie)
        field.aiVersions[existingVersionIndex] = {
          ...field.aiVersions[existingVersionIndex],
          value
        };
      } else {
        // Ajouter une nouvelle version
        field.aiVersions.push({
          version,
          value,
          createdAt: now
        });
      }
      field.updatedAt = now;
      
      const updatedFields = [...existingFields];
      updatedFields[existingFieldIndex] = field;
      
      return { fields: updatedFields, created: false, version, replaced: isReplacing };
    } else {
      // Créer un nouveau champ avec version 1 (ou vide si pas de valeur)
      const newField: UserDataField = {
        id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: formatTagAsName(tag),
        tag: tag,
        type: fieldType as any,
        baseLanguage: workingLanguage,
        languageVersions: [],
        aiVersions: hasValue ? [{
          version: 1,
          value,
          createdAt: now
        }] : [],
        createdAt: now,
        updatedAt: now,
      };
      
      return { fields: [...existingFields, newField], created: true, version: hasValue ? 1 : 0, replaced: false };
    }
  };

  // Formater un tag en nom lisible
  const formatTagAsName = (tag: string): string => {
    let formatted = tag
      .replace(/([A-Z])/g, ' $1')
      .replace(/([0-9]+)/g, ' $1 ')
      .replace(/_/g, ' ')
      .trim();
    
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // Importer les tags sélectionnés comme champs
  const handleImportSelectedTags = async () => {
    console.log('handleImportSelectedTags called', { user: !!user, setUser: !!setUser, extractedTags });
    
    if (!user) {
      setImportLog(prev => [...prev, '❌ Erreur: Utilisateur non connecté']);
      return;
    }
    
    if (!setUser) {
      setImportLog(prev => [...prev, '❌ Erreur: Contexte d\'authentification non disponible']);
      return;
    }
    
    if (extractedTags.length === 0) {
      setImportLog(prev => [...prev, '⚠️ Aucun tag à importer']);
      return;
    }
    
    setIsProcessing(true);
    setProcessingStatus('Import des champs en cours...');
    
    const workingLanguage = user.baseLanguage || 'fr';
    let currentFields = user.data ? [...user.data] : [];
    const logs: string[] = [];
    
    const tagsToImport = selectedTags.size > 0 
      ? extractedTags.filter(t => selectedTags.has(t.tag))
      : extractedTags;
    
    console.log('Tags to import:', tagsToImport);
    
    let createdCount = 0;
    let updatedCount = 0;
    let replacedCount = 0;
    let skippedCount = 0;
    
    for (const tagData of tagsToImport) {
      try {
        // Ne pas importer si pas de valeur
        if (!tagData.value || !tagData.value.trim()) {
          skippedCount++;
          continue;
        }
        
        const result = createOrUpdateField(currentFields, tagData.tag, tagData.value, workingLanguage);
        currentFields = result.fields;
        
        if (result.version === 0) {
          skippedCount++;
          continue;
        }
        
        if (result.created) {
          createdCount++;
          logs.push(`➕ Nouveau champ: ${tagData.tag} (v1)`);
        } else if (result.replaced) {
          replacedCount++;
          logs.push(`🔄 Champ remplacé: ${tagData.tag} (v3 écrasée)`);
        } else {
          updatedCount++;
          logs.push(`📝 Champ enrichi: ${tagData.tag} (v${result.version})`);
        }
      } catch (fieldError) {
        console.error('Error creating field:', tagData.tag, fieldError);
        logs.push(`❌ Erreur pour ${tagData.tag}: ${fieldError}`);
      }
    }
    
    try {
      const updatedUser = { ...user, data: currentFields };
      console.log('Saving user with', currentFields.length, 'fields to database');
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);
      
      // Résumé détaillé
      const summary: string[] = [];
      if (createdCount > 0) summary.push(`${createdCount} nouveaux`);
      if (updatedCount > 0) summary.push(`${updatedCount} enrichis`);
      if (replacedCount > 0) summary.push(`${replacedCount} remplacés`);
      if (skippedCount > 0) summary.push(`${skippedCount} ignorés (vides)`);
      
      logs.push(`✅ Import terminé: ${summary.join(', ')}`);
      logs.push(`💾 ${currentFields.length} champs sauvegardés en base de données`);
      
      if (onFieldsUpdated) {
        onFieldsUpdated(currentFields);
      }
    } catch (error) {
      console.error('Error saving fields:', error);
      logs.push(`❌ Erreur lors de la sauvegarde en base de données: ${error}`);
    }
    
    setImportLog(prev => [...prev, ...logs]);
    setIsProcessing(false);
    setProcessingStatus('');
  };

  // Importer uniquement les champs (sans valeurs)
  const handleImportFieldsOnly = async () => {
    console.log('handleImportFieldsOnly called', { user: !!user, setUser: !!setUser, extractedTags });
    
    if (!user) {
      setImportLog(prev => [...prev, '❌ Erreur: Utilisateur non connecté']);
      return;
    }
    
    if (!setUser) {
      setImportLog(prev => [...prev, '❌ Erreur: Contexte d\'authentification non disponible']);
      return;
    }
    
    if (extractedTags.length === 0) {
      setImportLog(prev => [...prev, '⚠️ Aucun tag à importer']);
      return;
    }
    
    setIsProcessing(true);
    setProcessingStatus('Création des champs vides...');
    
    const workingLanguage = user.baseLanguage || 'fr';
    let currentFields = user.data ? [...user.data] : [];
    const logs: string[] = [];
    
    const tagsToImport = selectedTags.size > 0 
      ? extractedTags.filter(t => selectedTags.has(t.tag))
      : extractedTags;
    
    console.log('Tags to import (fields only):', tagsToImport);
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const tagData of tagsToImport) {
      try {
        const exists = currentFields.some(f => f.tag && f.tag.toLowerCase() === tagData.tag.toLowerCase());
        
        if (!exists) {
          // allowEmpty=true pour créer des champs vides (structure uniquement)
          const result = createOrUpdateField(currentFields, tagData.tag, '', workingLanguage, 'text', true);
          currentFields = result.fields;
          createdCount++;
          logs.push(`➕ Nouveau champ: ${tagData.tag}`);
        } else {
          skippedCount++;
          logs.push(`⏭️ Champ existant: ${tagData.tag}`);
        }
      } catch (fieldError) {
        console.error('Error creating field:', tagData.tag, fieldError);
        logs.push(`❌ Erreur pour ${tagData.tag}: ${fieldError}`);
      }
    }
    
    try {
      const updatedUser = { ...user, data: currentFields };
      console.log('Saving user with', currentFields.length, 'fields to database');
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);
      
      logs.push(`✅ ${createdCount} champs créés, ${skippedCount} existants ignorés`);
      logs.push(`💾 ${currentFields.length} champs sauvegardés en base de données`);
      
      if (onFieldsUpdated) {
        onFieldsUpdated(currentFields);
      }
    } catch (error) {
      console.error('Error saving fields:', error);
      logs.push(`❌ Erreur lors de la sauvegarde en base de données: ${error}`);
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
    setCurrentFileImage('');
    setExtractedTags([]);
    setExtractedImages([]);
    setSelectedTags(new Set());
    setImportLog([]);
    setAiSummary('');
    setAiSuggestions([]);
  };

  // Obtenir le statut d'un tag par rapport aux champs existants
  const getTagStatus = (tag: string): 'new' | 'exists' | 'has-value' => {
    if (!user?.data) return 'new';
    
    const existingField = user.data.find(f => f.tag.toLowerCase() === tag.toLowerCase());
    if (!existingField) return 'new';
    
    const hasValue = existingField.aiVersions.some(v => v.value && v.value.trim() !== '');
    return hasValue ? 'has-value' : 'exists';
  };

  // Obtenir l'indicateur de confiance
  const getConfidenceIndicator = (confidence?: number): string => {
    if (!confidence) return '';
    if (confidence >= 0.9) return '🟢';
    if (confidence >= 0.7) return '🟡';
    if (confidence >= 0.5) return '🟠';
    return '🔴';
  };

  // Déclencher l'import via le file input
  const triggerFileInput = (mode: ImportMode) => {
    setImportMode(mode);
    // Petit délai pour que le state soit mis à jour avant l'ouverture
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  return (
    <div className={`pdf-fields-importer ${embeddedMode ? 'embedded' : ''}`}>
      {/* Header avec Mode IA intégré */}
      <div className="importer-header-row">
        <div className="importer-header">
          <h3>📥 Import de CV</h3>
          <p className="importer-description">
            Importez des templates avec tags <code>{'{TAG}'}</code> ou des vrais CV analysés par IA.
          </p>
        </div>
        
        {importMode === 'cv-ai' && (
          <div className="ai-mode-badge">
            <span className="ai-icon">🧠</span>
            <span className="ai-label">Mode IA activé</span>
            <select 
              value={aiProvider} 
              onChange={(e) => setAiProvider(e.target.value as AIProvider)}
              className="provider-select-compact"
              title="Moteur d'analyse"
            >
              <option value="combined">🔥 Affinda + OpenAI</option>
              <option value="affinda">📋 Affinda</option>
              <option value="openai">🤖 OpenAI</option>
            </select>
          </div>
        )}
      </div>

      {/* Boutons d'import directs - cliquables pour déclencher l'import */}
      <div className="import-mode-selector">
        <input
          ref={fileInputRef}
          type="file"
          id="pdf-import-input"
          accept={importMode === 'template' ? '.pdf,.txt,.tex' : '.pdf,.png,.jpg,.jpeg,.webp'}
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
          className="file-input-hidden"
        />
        <button 
          className={`mode-button import-trigger ${importMode === 'cv-ai' ? 'active' : ''}`}
          onClick={() => triggerFileInput('cv-ai')}
          disabled={isProcessing}
        >
          🤖 CV réel (Analyse IA)
        </button>
        <button 
          className={`mode-button import-trigger ${importMode === 'template' ? 'active' : ''}`}
          onClick={() => triggerFileInput('template')}
          disabled={isProcessing}
        >
          📋 Template (Tags)
        </button>
        
        {importedFiles.length > 0 && (
          <button onClick={handleReset} className="reset-button-inline">
            🔄
          </button>
        )}
      </div>

      <div className="importer-content">

        {/* Statut de traitement */}
        {isProcessing && (
          <div className="processing-status">
            <div className="spinner"></div>
            <span>{processingStatus}</span>
          </div>
        )}

        {/* Résumé IA */}
        {aiSummary && (
          <div className="ai-summary">
            <h4>📊 Analyse IA</h4>
            <p>{aiSummary}</p>
            {aiSuggestions.length > 0 && (
              <div className="ai-suggestions">
                <strong>💡 Suggestions:</strong>
                <ul>
                  {aiSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
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
                  <span className="file-mode">{file.mode === 'cv' ? '🤖' : '📋'}</span>
                  <span className="file-tags-count">{file.extractedTags.length} données</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images extraites */}
        {extractedImages.length > 0 && (
          <div className="extracted-images-section">
            <h4>🖼️ Éléments visuels détectés ({extractedImages.length})</h4>
            <div className="images-list">
              {extractedImages.map((img, idx) => (
                <div key={idx} className="image-item">
                  <span className="image-type">{img.type}</span>
                  <span className="image-description">{img.description}</span>
                  {img.suggestedTag && (
                    <span className="image-tag">→ {img.suggestedTag}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags extraits */}
        {extractedTags.length > 0 && (
          <div className="extracted-tags-section">
            <div className="tags-header">
              <h4>🏷️ Données extraites ({extractedTags.length})</h4>
              <button onClick={handleSelectAll} className="select-all-button">
                {selectedTags.size === extractedTags.length ? '☐ Désélectionner tout' : '☑ Sélectionner tout'}
              </button>
            </div>
            
            <div className="tags-legend">
              <span className="legend-item new">🆕 Nouveau champ</span>
              <span className="legend-item exists">📝 Existant (vide)</span>
              <span className="legend-item has-value">✅ Existant (rempli)</span>
              {importMode === 'cv-ai' && (
                <>
                  <span className="legend-item confidence">🟢 Confiance haute</span>
                  <span className="legend-item confidence">🟡 Moyenne</span>
                  <span className="legend-item confidence">🔴 Basse</span>
                </>
              )}
            </div>
            
            <div className="tags-list">
              {extractedTags.map((tagData, idx) => {
                const status = getTagStatus(tagData.tag);
                const isSelected = selectedTags.has(tagData.tag);
                const confidenceIcon = getConfidenceIndicator(tagData.confidence);
                
                return (
                  <div 
                    key={idx} 
                    className={`tag-item ${status} ${isSelected ? 'selected' : ''} ${tagData.isNew ? 'ai-new' : ''}`}
                    onClick={() => toggleTagSelection(tagData.tag)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="tag-checkbox"
                    />
                    <span className="tag-name">
                      {tagData.tag}
                      {tagData.isNew && <span className="new-badge">nouveau</span>}
                    </span>
                    {tagData.value && (
                      <span className="tag-value" title={tagData.value}>
                        = "{tagData.value.substring(0, 50)}{tagData.value.length > 50 ? '...' : ''}"
                      </span>
                    )}
                    <span className={`tag-status ${status}`}>
                      {confidenceIcon}
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
                📋 Créer les champs uniquement
              </button>
              <button 
                onClick={handleImportSelectedTags} 
                className="import-button with-values"
                disabled={isProcessing || extractedTags.length === 0}
              >
                📥 Importer champs + valeurs
              </button>
            </div>
          </div>
        )}

        {/* Aperçu de l'image du CV */}
        {currentFileImage && (
          <div className="image-preview-section">
            <div className="preview-header">
              <h4>🖼️ Aperçu du CV</h4>
              <button onClick={() => setCurrentFileImage('')} className="hide-preview-button">
                Masquer
              </button>
            </div>
            <div className="image-preview">
              <img src={currentFileImage} alt="CV Preview" />
            </div>
          </div>
        )}

        {/* Prévisualisation du texte */}
        {showPreview && currentFileText && (
          <div className="text-preview-section">
            <div className="preview-header">
              <h4>👁️ Texte extrait</h4>
              <button onClick={() => setShowPreview(false)} className="hide-preview-button">
                Masquer
              </button>
            </div>
            <div className="text-preview">
              {currentFileText.split('\n').map((line, idx) => (
                <div key={idx} className="preview-line">
                  {importMode === 'template' ? highlightTags(line) : line}
                </div>
              ))}
            </div>
          </div>
        )}

        {!showPreview && currentFileText && (
          <button onClick={() => setShowPreview(true)} className="show-preview-button">
            👁️ Afficher le texte
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
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="highlighted-tag">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
};

export default PDFFieldsImporter;
