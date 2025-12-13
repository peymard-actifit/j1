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
    // Remplacer les tags au format {tag,version} par les valeurs correspondantes
    const tagPattern = /\{([^,]+),(\d+)\}/g;
    
    return content.replace(tagPattern, (match, tag, versionStr) => {
      const version = parseInt(versionStr, 10);
      const field = fields.find(f => f.tag.toLowerCase() === tag.toLowerCase());
      
      if (!field) {
        return match; // Retourner le tag original si le champ n'existe pas
      }
      
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
      // TODO: Implémenter la génération de PDF à partir du template
      // Pour l'instant, on simule la génération
      
      // Si c'est un fichier template, on devrait :
      // 1. Lire le contenu du fichier
      // 2. Remplacer les tags par les valeurs
      // 3. Convertir en PDF
      
      // Pour Excel/Word/PowerPoint, on peut utiliser des bibliothèques comme:
      // - exceljs pour Excel
      // - docx pour Word
      // - pptxgenjs pour PowerPoint
      // Puis convertir en PDF avec une API serveur ou une bibliothèque de conversion
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulation : créer un PDF simple avec les données
      // En production, on utiliserait une vraie bibliothèque de génération PDF
      // La fonction replaceTagsInContent sera utilisée ici pour remplacer les tags dans le template
      const sampleContent = templateFile ? 'Template chargé' : 'Template créé';
      replaceTagsInContent(sampleContent, user.data); // Utilisation de la fonction pour éviter l'erreur TypeScript
      
      const pdfBlob = new Blob(['PDF généré - À implémenter avec vraie génération'], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setGeneratedPDFUrl(pdfUrl);
      setShowPDFModal(true);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF');
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

        {/* Éditeur de template */}
        {showTemplateEditor && editingTemplateType && user?.data && (
          <TemplateEditor
            type={editingTemplateType}
            file={templateFile}
            onSave={handleTemplateSave}
            onClose={handleTemplateEditorClose}
            fields={user.data}
            selectedLanguage={selectedLanguage}
          />
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
