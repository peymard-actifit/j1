import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserDataField } from '../types/database';
import { TemplateEditor } from './TemplateEditor';
import './CVProducer.css';

interface CVProducerProps {
  onCancel?: () => void;
  embeddedMode?: boolean;
}

const availableLanguages = [
  'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko',
  'ar', 'cs', 'da', 'el', 'hu', 'id', 'nb', 'sv', 'tr', 'uk'
];

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
  'uk': 'Ukrainien'
};

export const CVProducer = ({ onCancel, embeddedMode = false }: CVProducerProps) => {
  const { user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateType, setTemplateType] = useState<'excel' | 'word' | 'powerpoint' | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [generatedPDFUrl, setGeneratedPDFUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTemplateType, setEditingTemplateType] = useState<'excel' | 'word' | 'powerpoint' | null>(null);
  const [cvPrompt] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialiser la langue avec la langue de base de l'utilisateur
  useEffect(() => {
    if (user?.baseLanguage) {
      setSelectedLanguage(user.baseLanguage);
    }
  }, [user?.baseLanguage]);

  const handleTemplateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        setTemplateType('excel');
        setTemplateFile(file);
        setShowTemplateModal(false);
        // Ouvrir l'éditeur avec le fichier
        setEditingTemplateType('excel');
        setShowTemplateEditor(true);
      } else if (ext === 'docx' || ext === 'doc') {
        setTemplateType('word');
        setTemplateFile(file);
        setShowTemplateModal(false);
        // Ouvrir l'éditeur avec le fichier
        setEditingTemplateType('word');
        setShowTemplateEditor(true);
      } else if (ext === 'pptx' || ext === 'ppt') {
        setTemplateType('powerpoint');
        setTemplateFile(file);
        setShowTemplateModal(false);
        // Ouvrir l'éditeur avec le fichier
        setEditingTemplateType('powerpoint');
        setShowTemplateEditor(true);
      } else {
        alert('Format de fichier non supporté. Veuillez choisir un fichier Excel, Word ou PowerPoint.');
      }
    }
  };

  const handleCreateNewTemplate = (type: 'excel' | 'word' | 'powerpoint') => {
    setTemplateType(type);
    setTemplateFile(null);
    setShowTemplateModal(false);
    // Ouvrir l'éditeur pour créer un nouveau template
    setEditingTemplateType(type);
    setShowTemplateEditor(true);
  };

  const handleTemplateSave = (savedFile: File) => {
    setTemplateFile(savedFile);
    setShowTemplateEditor(false);
    setEditingTemplateType(null);
  };

  const handleTemplateEditorClose = () => {
    setShowTemplateEditor(false);
    setEditingTemplateType(null);
  };

  const replaceTagsInContent = (content: string, fields: UserDataField[]): string => {
    // Remplacer les tags au format {tag,version} ou {tag,IA} ou {tag} (version 1 par défaut)
    // Pattern pour {tag,version}, {tag,IA}, ou {tag}
    const tagPattern = /\{([^,}]+)(?:,([^}]+))?\}/g;
    
    return content.replace(tagPattern, (match, tag, versionOrIA) => {
      const field = fields.find(f => f.tag.toLowerCase() === tag.toLowerCase());
      
      if (!field) {
        return match; // Retourner le tag original si le champ n'existe pas
      }
      
      // Si pas de version spécifiée, utiliser version 1 par défaut
      if (!versionOrIA) {
        versionOrIA = '1';
      }
      
      // Si c'est ,IA, on utilisera le prompt pour générer le contenu (à implémenter avec l'IA)
      if (versionOrIA === 'IA') {
        // Pour l'instant, on retourne un placeholder
        // TODO: Appeler l'IA avec le prompt CV pour générer le contenu
        return `[IA:${tag}]`; // Placeholder pour le contenu généré par IA
      }
      
      // Sinon, c'est une version numérique
      const version = parseInt(versionOrIA, 10);
      
      // Récupérer la valeur selon la langue sélectionnée
      let value = '';
      if (selectedLanguage === field.baseLanguage) {
        const aiVersion = field.aiVersions.find(v => v.version === version);
        value = aiVersion?.value || '';
      } else {
        const langVersion = field.languageVersions.find(
          v => v.language === selectedLanguage && v.version === version
        );
        value = langVersion?.value || '';
      }
      
      return value || match; // Retourner la valeur ou le tag original si vide
    });
  };

  const handleGeneratePDF = async () => {
    if (!templateFile && !templateType) {
      alert('Veuillez d\'abord sélectionner ou créer un template');
      return;
    }

    if (!user?.data) {
      alert('Aucune donnée utilisateur disponible');
      return;
    }

    setIsGenerating(true);
    try {
      let content = '';
      let processedContent = '';

      // 1. Lire le contenu du template
      if (templateFile) {
        // Lire le fichier template
        if (templateType === 'word') {
          const mammoth = await import('mammoth');
          const arrayBuffer = await templateFile.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value || '';
        } else if (templateType === 'excel') {
          const XLSX = await import('xlsx');
          const arrayBuffer = await templateFile.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          content = data.map((row: any) => Array.isArray(row) ? row.join('\t') : String(row)).join('\n');
        } else if (templateType === 'powerpoint') {
          // Pour PowerPoint, on ne peut pas facilement lire le contenu
          // On va créer un PDF basique avec les données
          content = 'CV généré depuis template PowerPoint\n\n';
        }
      } else {
        // Template créé mais pas de fichier - utiliser un template par défaut
        content = `CV - ${user.name || 'Utilisateur'}\n\n`;
        content += `Nom: {nom,1}\n`;
        content += `Prénom: {prenom,1}\n`;
        content += `Email: {mail,1}\n`;
        content += `Téléphone: {telephone,1}\n\n`;
        content += `Résumé: {resumegeneral,1}\n\n`;
      }

      // 2. Remplacer les tags par les valeurs
      processedContent = replaceTagsInContent(content, user.data);

      // 3. Générer le PDF avec jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Configuration
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = margin;
      const lineHeight = 7;
      const fontSize = 12;

      doc.setFontSize(fontSize);

      // Diviser le contenu en lignes et les ajouter au PDF
      const lines = processedContent.split('\n');
      for (const line of lines) {
        // Vérifier si on doit créer une nouvelle page
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }

        // Diviser les lignes longues en plusieurs lignes si nécessaire
        const splitLines = doc.splitTextToSize(line, maxWidth);
        for (const splitLine of splitLines) {
          if (yPosition + lineHeight > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(splitLine, margin, yPosition);
          yPosition += lineHeight;
        }
      }

      // Générer le blob PDF
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setGeneratedPDFUrl(pdfUrl);
      setShowPDFModal(true);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert(`Erreur lors de la génération du PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (generatedPDFUrl) {
      const link = document.createElement('a');
      link.href = generatedPDFUrl;
      link.download = `CV_${user?.name || 'utilisateur'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClosePDFModal = () => {
    if (generatedPDFUrl) {
      URL.revokeObjectURL(generatedPDFUrl);
      setGeneratedPDFUrl(null);
    }
    setShowPDFModal(false);
  };

  if (embeddedMode) {
    return (
      <>
        <div className="cv-producer-embedded">
          <div className="cv-producer-header">
            <h3>Production de CV</h3>
            {onCancel && (
              <button className="close-producer-button" onClick={onCancel} title="Fermer">
                ✕
              </button>
            )}
          </div>
          
          <div className="cv-producer-controls">
            <div className="control-group">
              <select 
                value={selectedLanguage} 
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="language-select"
              >
                {availableLanguages.map(lang => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()} - {languageNames[lang] || lang}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <button 
                className="template-button"
                onClick={() => setShowTemplateModal(true)}
              >
                {templateFile ? `📄 ${templateFile.name}` : templateType ? `📄 Template ${templateType}` : '📄 Choisir/Créer Template'}
              </button>
            </div>

            <button 
              className="generate-pdf-button"
              onClick={handleGeneratePDF}
              disabled={isGenerating || (!templateFile && !templateType)}
            >
              {isGenerating ? 'Génération...' : '📄 Générer le PDF'}
            </button>
          </div>


          <div className="cv-producer-info">
            {showTemplateEditor && editingTemplateType && user?.data ? (
              <TemplateEditor
                type={editingTemplateType}
                file={templateFile}
                onSave={handleTemplateSave}
                onClose={handleTemplateEditorClose}
                fields={user.data}
                selectedLanguage={selectedLanguage}
                cvPrompt={cvPrompt}
              />
            ) : (
              <div className="info-section">
                <h4>Format des tags dans les templates</h4>
                <p>Utilisez le format <code>{'{tag,version}'}</code> dans vos templates pour référencer les champs.</p>
                <p>Exemples :</p>
                <ul>
                  <li><code>{'{nom,1}'}</code> - Nom (version 1)</li>
                  <li><code>{'{prenom,1}'}</code> - Prénom (version 1)</li>
                  <li><code>{'{email,1}'}</code> - Email (version 1)</li>
                  <li><code>{'{XP01,1}'}</code> - Expérience 1, champ 1</li>
                  <li><code>{'{XP01,2}'}</code> - Expérience 1, champ 2</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Modal de sélection/création de template */}
        {showTemplateModal && (
          <div className="template-modal-overlay" onClick={() => setShowTemplateModal(false)}>
            <div className="template-modal" onClick={(e) => e.stopPropagation()}>
              <div className="template-modal-header">
                <h3>Gérer le Template</h3>
                <button className="close-modal-button" onClick={() => setShowTemplateModal(false)}>✕</button>
              </div>
              <div className="template-modal-content">
                <div className="template-option">
                  <h4>Choisir un fichier template</h4>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.docx,.doc,.pptx,.ppt"
                    onChange={handleTemplateFileSelect}
                    style={{ display: 'none' }}
                  />
                  <button 
                    className="template-action-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📁 Choisir un fichier
                  </button>
                  <p className="template-hint">Formats acceptés : Excel (.xlsx, .xls), Word (.docx, .doc), PowerPoint (.pptx, .ppt)</p>
                </div>

                <div className="template-divider">OU</div>

                <div className="template-option">
                  <h4>Créer un nouveau template</h4>
                  <div className="template-create-buttons">
                    <button 
                      className="template-action-button"
                      onClick={() => handleCreateNewTemplate('excel')}
                    >
                      📊 Excel
                    </button>
                    <button 
                      className="template-action-button"
                      onClick={() => handleCreateNewTemplate('word')}
                    >
                      📝 Word
                    </button>
                    <button 
                      className="template-action-button"
                      onClick={() => handleCreateNewTemplate('powerpoint')}
                    >
                      📊 PowerPoint
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal d'affichage du PDF généré */}
        {showPDFModal && generatedPDFUrl && (
          <div className="pdf-modal-overlay" onClick={handleClosePDFModal}>
            <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pdf-modal-header">
                <h3>CV généré</h3>
                <div className="pdf-modal-actions">
                  <button className="download-pdf-button" onClick={handleDownloadPDF}>
                    💾 Télécharger
                  </button>
                  <button className="close-modal-button" onClick={handleClosePDFModal}>✕</button>
                </div>
              </div>
              <div className="pdf-modal-content">
                <iframe 
                  src={generatedPDFUrl}
                  className="pdf-preview-iframe"
                  title="Aperçu du CV généré"
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Mode modal (non utilisé pour l'instant)
  return null;
};
