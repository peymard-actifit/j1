import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage, mergeDefaultFieldsWithExisting, initializeDefaultStructure } from '../utils/storage';
import { UserDataField } from '../types/database';
import { FieldEditor } from './DataEditor';
import { PDFFieldsImporter } from './PDFFieldsImporter';
import './CVImportNew.css';

interface CVImportNewProps {
  onComplete: () => void;
  onCancel: () => void;
  embeddedMode?: boolean;
}

type ImportMode = 'manual' | 'auto';

export const CVImportNew = ({ onCancel, embeddedMode = false }: CVImportNewProps) => {
  const [importMode, setImportMode] = useState<ImportMode>('auto');
  const { user, setUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [pdfTextContent, setPdfTextContent] = useState<string>('');
  const [extractingPdfText, setExtractingPdfText] = useState(false);
  const [userFields, setUserFields] = useState<UserDataField[]>([]);
  const [selectedField, setSelectedField] = useState<UserDataField | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedIndices, setDraggedIndices] = useState<number[]>([]);
  const [fieldsListWidth, setFieldsListWidth] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const [workingLanguage, setWorkingLanguage] = useState<string>(user?.baseLanguage || 'fr');
  const [selectedText, setSelectedText] = useState<string>('');
  const [showFieldSelectionModal, setShowFieldSelectionModal] = useState(false);
  const cvDisplayRef = useRef<HTMLDivElement>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldTag, setNewFieldTag] = useState('');

  useEffect(() => {
    if (user) {
      if (user.data && user.data.length > 0) {
        // Fusionner les nouveaux champs par défaut avec les données existantes
        const mergedFields = mergeDefaultFieldsWithExisting(user.data);
        setUserFields(mergedFields);
        // Si de nouveaux champs ont été ajoutés, sauvegarder
        if (mergedFields.length > user.data.length && setUser) {
          const updatedUser = { ...user, data: mergedFields };
          storage.saveUser(updatedUser).then(saved => {
            setUser(saved);
          }).catch(error => {
            console.error('Error saving merged fields:', error);
          });
        }
      } else {
        const defaultFields = initializeDefaultStructure();
        setUserFields(defaultFields);
      }
    }
  }, [user, setUser]);

  useEffect(() => {
    if (user && !workingLanguage) {
      setWorkingLanguage(user.baseLanguage || 'fr');
    }
  }, [user?.id]);

  // Fonction pour extraire le texte du PDF avec pdf.js (solution de secours)
  const extractPdfTextWithPdfJs = async (file: File): Promise<void> => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      // Configurer le worker - utiliser le worker local d'abord, puis les CDN en fallback
      // Pour pdfjs-dist 5.4.449, le worker est en .mjs
      const workerVersion = pdfjsLib.version || '5.4.449';
      const workerPaths = [
        '/pdf.worker.min.mjs', // Worker local dans public (priorité)
        `https://unpkg.com/pdfjs-dist@${workerVersion}/build/pdf.worker.min.mjs`, // unpkg avec .mjs
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${workerVersion}/build/pdf.worker.min.mjs`, // jsdelivr avec .mjs
      ];
      
      // Utiliser le premier chemin disponible (le local en priorité)
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerPaths[0];
      
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
            // Essayer d'abord avec l'API Vision (si disponible)
            try {
              const { api } = await import('../utils/api');
              // Convertir le PDF en image pour l'OCR Vision
              const pdfjsLib = await import('pdfjs-dist');
              pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
              const arrayBuffer = await selectedFile.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              const page = await pdf.getPage(1);
              const scale = 2;
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d')!;
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              await page.render({ canvasContext: context, viewport, canvas } as any).promise;
              const imageBase64 = canvas.toDataURL('image/png');
              
              const result = await api.extractPdfText({ imageBase64, extractionMode: 'full' });
              if (result && result.success && result.text && result.text.trim().length > 0) {
                setPdfTextContent(result.text);
                setExtractingPdfText(false);
                return;
              }
            } catch (apiError) {
              console.warn('API extraction failed, trying pdf.js:', apiError);
            }
            
            // Fallback : utiliser pdf.js côté client
            await extractPdfTextWithPdfJs(selectedFile);
          } catch (error) {
            console.error('Error extracting PDF text:', error);
            setPdfTextContent('Erreur lors de l\'extraction du texte du PDF. Veuillez réessayer ou utiliser un autre format.');
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

  const findAvailableVersion = (field: UserDataField, language: string): 1 | 2 | 3 => {
    // Chercher la première version vide
    if (language === field.baseLanguage) {
      const v1 = field.aiVersions.find(v => v.version === 1)?.value || '';
      const v2 = field.aiVersions.find(v => v.version === 2)?.value || '';
      if (!v1 || v1.trim() === '') return 1;
      if (!v2 || v2.trim() === '') return 2;
      return 3;
    } else {
      const versions = field.languageVersions.filter(v => v.language === language);
      const v1 = versions.find(v => v.version === 1)?.value || '';
      const v2 = versions.find(v => v.version === 2)?.value || '';
      if (!v1 || v1.trim() === '') return 1;
      if (!v2 || v2.trim() === '') return 2;
      return 3;
    }
  };

  const getRelevantFields = (text: string): UserDataField[] => {
    // Logique simple pour trouver des champs pertinents basée sur les mots-clés
    const textLower = text.toLowerCase();
    const keywords: Record<string, string[]> = {
      'nom': ['nom', 'name', 'prénom', 'prenom', 'firstname'],
      'prénom': ['prénom', 'prenom', 'firstname', 'first name'],
      'email': ['email', 'e-mail', 'mail', 'courriel'],
      'téléphone': ['téléphone', 'telephone', 'phone', 'tel', 'mobile'],
      'adresse': ['adresse', 'address', 'rue', 'street'],
      'expérience': ['expérience', 'experience', 'xp', 'emploi', 'job', 'travail', 'work'],
      'formation': ['formation', 'education', 'diplôme', 'diplome', 'université', 'university', 'école', 'ecole'],
      'compétence': ['compétence', 'competence', 'skill', 'savoir', 'savoir-faire'],
      'langue': ['langue', 'language', 'lang', 'anglais', 'english', 'français', 'french'],
      'projet': ['projet', 'project', 'réalisation', 'realisation'],
    };

    const scoredFields = userFields.map(field => {
      let score = 0;
      const fieldNameLower = field.name.toLowerCase();
      const fieldTagLower = field.tag.toLowerCase();

      for (const [category, keys] of Object.entries(keywords)) {
        if (keys.some(key => textLower.includes(key))) {
          if (fieldNameLower.includes(category) || fieldTagLower.includes(category)) {
            score += 10;
          }
        }
      }

      // Bonus si le tag ou le nom contient des mots du texte
      const textWords = textLower.split(/\s+/).filter(w => w.length > 3);
      textWords.forEach(word => {
        if (fieldNameLower.includes(word) || fieldTagLower.includes(word)) {
          score += 5;
        }
      });

      return { field, score };
    });

    // Retourner les 5 champs les plus pertinents
    return scoredFields
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.field);
  };

  const handleTextSelection = () => {
    // Annuler le timeout précédent s'il existe
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    
    // Attendre un peu pour que la sélection soit complète
    selectionTimeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const text = selection.toString().trim();
        // Vérifier que le texte n'est pas vide et qu'il vient bien de la zone PDF
        if (text.length > 0) {
          setSelectedText(text);
          // Afficher le pop-up avec les champs pertinents
          setShowFieldSelectionModal(true);
        }
      }
    }, 100);
  };

  // Écouteur global pour détecter les changements de sélection
  useEffect(() => {
    const checkSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const text = selection.toString().trim();
        // Vérifier que la sélection est dans la zone du CV
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        let isInCVArea = false;
        
        if (range) {
          const container = range.commonAncestorContainer;
          const cvDisplay = cvDisplayRef.current;
          if (cvDisplay) {
            // Vérifier si la sélection est dans la zone d'affichage du CV
            const node = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Node;
            if (node && cvDisplay.contains(node)) {
              isInCVArea = true;
            }
          }
        } else {
          // Si pas de range, supposer que c'est dans le PDF (embed peut ne pas exposer de range)
          // Vérifier si le focus est dans la zone du CV
          const activeElement = document.activeElement;
          const cvDisplay = cvDisplayRef.current;
          if (cvDisplay && (activeElement?.tagName === 'EMBED' || cvDisplay.contains(activeElement))) {
            isInCVArea = true;
          }
        }
        
        if (isInCVArea && text.length > 0 && text !== selectedText) {
          setSelectedText(text);
          setShowFieldSelectionModal(true);
        }
      } else if (selectedText && (!selection || !selection.toString().trim())) {
        // Si la sélection a été effacée, ne pas fermer le pop-up immédiatement
        // (l'utilisateur peut vouloir glisser le texte déjà sélectionné)
      }
    };

    const handleSelectionChange = () => {
      // Délai pour laisser le temps à la sélection de se compléter
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      
      selectionTimeoutRef.current = setTimeout(() => {
        checkSelection();
      }, 100);
    };

    // Écouter les changements de sélection
    document.addEventListener('selectionchange', handleSelectionChange);
    // Écouter aussi mouseup pour capturer les sélections dans les embeds
    document.addEventListener('mouseup', handleSelectionChange);
    
    // Vérifier périodiquement la sélection (pour les PDF embeds qui ne déclenchent pas toujours les événements)
    selectionIntervalRef.current = setInterval(() => {
      checkSelection();
    }, 300); // Vérifier toutes les 300ms
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleSelectionChange);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      if (selectionIntervalRef.current) {
        clearInterval(selectionIntervalRef.current);
      }
    };
  }, [selectedText]);

  const handleInsertIntoField = async (field: UserDataField) => {
    if (!selectedText || !user || !setUser) return;

    const version = findAvailableVersion(field, workingLanguage);
    const updatedField = { ...field };

    if (workingLanguage === field.baseLanguage) {
      // Mettre à jour dans aiVersions
      const existingIndex = updatedField.aiVersions.findIndex(v => v.version === version);
      if (existingIndex >= 0) {
        updatedField.aiVersions[existingIndex].value = selectedText;
      } else {
        updatedField.aiVersions.push({
          version: version,
          value: selectedText,
          createdAt: new Date().toISOString()
        });
      }
    } else {
      // Mettre à jour dans languageVersions
      const existingIndex = updatedField.languageVersions.findIndex(
        v => v.language === workingLanguage && v.version === version
      );
      if (existingIndex >= 0) {
        updatedField.languageVersions[existingIndex].value = selectedText;
      } else {
        updatedField.languageVersions.push({
          language: workingLanguage,
          version: version,
          value: selectedText,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Sauvegarder
    const updatedFields = userFields.map(f => f.id === field.id ? updatedField : f);
    setUserFields(updatedFields);

    try {
      const updatedUser = { ...user, data: updatedFields };
      const savedUser = await storage.saveUser(updatedUser);
      setUser(savedUser);
    } catch (error) {
      console.error('Error saving field:', error);
    }

    // Fermer le pop-up et réinitialiser
    setShowFieldSelectionModal(false);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  const handleDragStart = (e: React.DragEvent, text: string) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
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
          .map(id => userFields.findIndex(f => f.id === id))
          .filter(idx => idx !== -1);
        
        const clickedIndex = userFields.findIndex(f => f.id === field.id);
        
        if (selectedIndices.length > 0 && clickedIndex !== -1) {
          const firstSelectedIndex = Math.min(...selectedIndices);
          const lastSelectedIndex = Math.max(...selectedIndices);
          
          // Déterminer la plage : du premier sélectionné au champ cliqué
          const startIndex = Math.min(firstSelectedIndex, clickedIndex);
          const endIndex = Math.max(lastSelectedIndex, clickedIndex);
          
          // Sélectionner tous les champs dans la plage
          const rangeFields = userFields.slice(startIndex, endIndex + 1);
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

  const handleFieldDragStart = (index: number, e: React.DragEvent) => {
    if (selectedFields.size > 1 && selectedFields.has(userFields[index].id)) {
      // Drag en groupe
      const indices = userFields
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
      setSelectedFields(new Set([userFields[index].id]));
    }
  };

  const handleFieldDragOver = (e: React.DragEvent, index: number) => {
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
      
      const newFields = [...userFields];
      const draggedItems = sourceIndices.map(i => newFields[i]);
      
      // Retirer les éléments de leur position actuelle (en ordre inverse)
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
      setUserFields(newFields);
      
      // Mettre à jour les indices
      const newIndices = draggedItems.map((_, i) => insertIndex + i);
      setDraggedIndices(newIndices);
    } else if (draggedIndex !== null && draggedIndex !== index) {
      // Déplacement unitaire
      const newFields = [...userFields];
      const draggedItem = newFields[draggedIndex];
      newFields.splice(draggedIndex, 1);
      newFields.splice(index, 0, draggedItem);
      setUserFields(newFields);
      setDraggedIndex(index);
    }
  };

  const handleFieldDragEnd = async () => {
    if ((draggedIndex !== null || draggedIndices.length > 0) && user && setUser) {
      try {
        const updatedUser = { ...user, data: userFields };
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
      if (newWidth >= 150 && newWidth <= 500) {
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

  // Modal de sélection de champ
  const relevantFields = selectedText ? getRelevantFields(selectedText) : [];

  const renderModal = () => (
    showFieldSelectionModal && selectedText && (
      <div className="field-selection-modal-overlay" onClick={() => {
        setShowFieldSelectionModal(false);
        setSelectedText('');
        window.getSelection()?.removeAllRanges();
      }}>
        <div className="field-selection-modal" onClick={(e) => e.stopPropagation()}>
          <div className="field-selection-modal-header">
            <h3>Où placer ce texte ?</h3>
            <button 
              className="close-modal-button"
              onClick={() => {
                setShowFieldSelectionModal(false);
                setSelectedText('');
                window.getSelection()?.removeAllRanges();
              }}
            >
              ✕
            </button>
          </div>
          <div className="field-selection-modal-content">
            <div className="selected-text-preview">
              <strong>Texte sélectionné :</strong>
              <p>"{selectedText.substring(0, 100)}{selectedText.length > 100 ? '...' : ''}"</p>
            </div>
            {relevantFields.length > 0 ? (
              <div className="relevant-fields-list">
                <p className="suggestion-label">Champs suggérés :</p>
                {relevantFields.map(field => (
                  <button
                    key={field.id}
                    className="field-suggestion-button"
                    onClick={() => handleInsertIntoField(field)}
                  >
                    <span className="field-suggestion-name">{field.name}</span>
                    <span className="field-suggestion-tag">({field.tag})</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="no-suggestions">Aucun champ suggéré. Sélectionnez un champ manuellement.</p>
            )}
            <div className="all-fields-list">
              <p className="all-fields-label">Tous les champs :</p>
              <div className="all-fields-scroll">
                {userFields.map(field => (
                  <button
                    key={field.id}
                    className="field-option-button"
                    onClick={() => handleInsertIntoField(field)}
                  >
                    <span className="field-option-name">{field.name}</span>
                    <span className="field-option-tag">({field.tag})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  );

  if (embeddedMode) {
    // Mode intégré dans DataEditor (sans overlay)
    return (
      <>
        <div className="cv-import-new-embedded">
          {/* Onglets de mode d'import */}
          <div className="import-mode-tabs">
            <button 
              className={`mode-tab ${importMode === 'auto' ? 'active' : ''}`}
              onClick={() => setImportMode('auto')}
            >
              🤖 Import automatique
            </button>
            <button 
              className={`mode-tab ${importMode === 'manual' ? 'active' : ''}`}
              onClick={() => setImportMode('manual')}
            >
              ✋ Import manuel
            </button>
          </div>

          {importMode === 'auto' ? (
            /* Mode import automatique avec PDFFieldsImporter */
            <div className="auto-import-container">
              <PDFFieldsImporter 
                embeddedMode={true}
                onFieldsUpdated={(fields) => {
                  setUserFields(fields);
                }}
              />
            </div>
          ) : (
            /* Mode import manuel - affichage du document */
            <div className="cv-import-new-content-embedded">
              <div className="cv-display-panel">
                {!file && (
                  <div className="file-selector-embedded">
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

                {extractingPdfText && (
                  <div className="analysis-progress">
                    <p>Extraction du texte du PDF...</p>
                  </div>
                )}

                <div
                  ref={cvDisplayRef}
                  className="cv-display-content"
                >
                  {fileType === 'application/pdf' && fileContent ? (
                    <div className="pdf-container">
                      <embed
                        src={`${fileContent}#toolbar=0&navpanes=0&scrollbar=1`}
                        type="application/pdf"
                        className="pdf-viewer"
                        title="CV PDF"
                      />
                      <div
                        className="pdf-selection-overlay"
                        style={{ pointerEvents: 'none' }}
                      />
                    </div>
                  ) : fileContent ? (
                    <div className="text-content" onMouseUp={handleTextSelection} onSelect={handleTextSelection}>
                      {fileContent.split('\n').map((line, idx) => (
                        <div key={idx} className="text-line">
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-cv-message">
                      <p>Sélectionnez un fichier CV pour commencer</p>
                      <p className="hint">Formats acceptés : PDF, Word, Excel, PowerPoint, LaTeX, Texte</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {renderModal()}
      </>
    );
  }

  // Mode overlay (ancien comportement)
  return (
    <>
      <div className="cv-import-new-overlay">
        <div className="cv-import-new">
          <div className="cv-import-new-header">
            <h2>Importer un CV</h2>
            <button onClick={onCancel} className="close-button">✕</button>
          </div>
          <div className="cv-import-new-content">
          {/* Le contenu est copié depuis le mode embedded ci-dessus */}
          <div className="cv-display-panel">
            <div className="cv-display-header">
              <h3>CV importé</h3>
              {!file && (
                <div className="file-selector">
                  <input
                    type="file"
                    id="cv-file-input-overlay"
                    accept=".pdf,.doc,.docx,.tex,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={handleFileChange}
                    className="file-input"
                  />
                  <label htmlFor="cv-file-input-overlay" className="file-input-label">
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
              {fileType === 'application/pdf' && fileContent ? (
                <>
                  <div className="pdf-container">
                    <embed
                      src={`${fileContent}#toolbar=0&navpanes=0&scrollbar=1`}
                      type="application/pdf"
                      className="pdf-viewer"
                      title="CV PDF"
                      onMouseUp={handleTextSelection}
                    />
                    {selectedText && selectedText.trim().length > 0 && (
                      <div
                        className="pdf-drag-overlay"
                        draggable={true}
                        onDragStart={(e) => {
                          if (selectedText && selectedText.trim().length > 0) {
                            handleDragStart(e, selectedText);
                          }
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div className="drag-indicator">
                          <span>📎 Glisser "{selectedText.substring(0, 30)}{selectedText.length > 30 ? '...' : ''}" vers un champ</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {pdfTextContent && (
                    <div 
                      className="text-content pdf-text-content"
                      onMouseUp={handleTextSelection}
                      onSelect={handleTextSelection}
                    >
                      <div className="pdf-text-header">
                        <strong>Texte extrait (sélectionnable pour glisser-déposer) :</strong>
                      </div>
                      {pdfTextContent.split('\n').map((line, idx) => {
                        const trimmedLine = line.trim();
                        if (trimmedLine.length === 0) {
                          return <div key={idx} className="text-line-empty">&nbsp;</div>;
                        }
                        const isSelected = selectedText ? line.includes(selectedText) : false;
                        return (
                          <div
                            key={idx}
                            className={`text-line ${isSelected ? 'selected-text' : ''}`}
                            draggable={isSelected && !!selectedText && selectedText.trim().length > 0}
                            onDragStart={(e) => {
                              if (selectedText && selectedText.trim().length > 0) {
                                handleDragStart(e, selectedText);
                              }
                            }}
                            onMouseDown={() => {}}
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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
              <div className="fields-list" style={{ width: `${fieldsListWidth}px` }}>
                <div className="fields-list-header-import">
                  <button 
                    onClick={() => setShowAddField(!showAddField)} 
                    className="add-field-button-import"
                  >
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
                {userFields.map((field, index) => {
                  const isSelected = selectedFields.has(field.id);
                  const isDragging = draggedIndex === index || draggedIndices.includes(index);
                  return (
                    <div
                      key={field.id}
                      className={`field-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${selectedFields.size > 1 && isSelected ? 'multi-selected' : ''}`}
                      onClick={(e) => handleFieldClick(field, e)}
                      draggable
                      onDragStart={(e) => handleFieldDragStart(index, e)}
                      onDragOver={(e) => handleFieldDragOver(e, index)}
                      onDragEnd={handleFieldDragEnd}
                    >
                      <span className="drag-handle">☰</span>
                      <div className="field-item-content">
                        <span className="field-name">{field.name}</span>
                        <span className="field-tag">{field.tag}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div 
                className="fields-list-resizer"
                onMouseDown={handleResizeStart}
                style={{ cursor: 'col-resize' }}
              />
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
      {renderModal()}
    </>
  );
};

