import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserDataField } from '../types/database';
import './CVProducer.css';

interface CVProducerProps {
  onCancel?: () => void;
  embeddedMode?: boolean;
}

export const CVProducer = ({ onCancel, embeddedMode = false }: CVProducerProps) => {
  const { user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('classic');
  const [previewMode, setPreviewMode] = useState<'preview' | 'pdf'>('preview');
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialiser la langue avec la langue de base de l'utilisateur
  useEffect(() => {
    if (user?.baseLanguage) {
      setSelectedLanguage(user.baseLanguage);
    }
  }, [user?.baseLanguage]);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      // TODO: Implémenter la génération de PDF
      // Options possibles :
      // 1. Utiliser jsPDF pour générer le PDF côté client
      // 2. Utiliser html2pdf pour convertir le HTML en PDF
      // 3. Envoyer les données à une API serveur pour génération
      // 4. Utiliser react-pdf pour créer un PDF React
      
      // Simulation pour l'instant
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Génération de PDF - À implémenter');
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const getFieldValue = (field: UserDataField, version: number = 1): string => {
    if (selectedLanguage === field.baseLanguage) {
      const aiVersion = field.aiVersions.find(v => v.version === version);
      return aiVersion?.value || '';
    } else {
      const langVersion = field.languageVersions.find(
        v => v.language === selectedLanguage && v.version === version
      );
      return langVersion?.value || '';
    }
  };

  const renderCVPreview = () => {
    if (!user?.data) return null;

    const fields = user.data;
    
    return (
      <div className="cv-preview-content">
        <div className="cv-preview-header">
          <h1>{getFieldValue(fields.find(f => f.tag === 'nom') || fields[0], 1)} {getFieldValue(fields.find(f => f.tag === 'prenom') || fields[0], 1)}</h1>
          <div className="cv-preview-contact">
            {getFieldValue(fields.find(f => f.tag === 'email') || fields[0], 1) && (
              <span>📧 {getFieldValue(fields.find(f => f.tag === 'email') || fields[0], 1)}</span>
            )}
            {getFieldValue(fields.find(f => f.tag === 'telephone') || fields[0], 1) && (
              <span>📱 {getFieldValue(fields.find(f => f.tag === 'telephone') || fields[0], 1)}</span>
            )}
            {getFieldValue(fields.find(f => f.tag === 'adresse') || fields[0], 1) && (
              <span>📍 {getFieldValue(fields.find(f => f.tag === 'adresse') || fields[0], 1)}</span>
            )}
          </div>
        </div>

        <div className="cv-preview-section">
          <h2>Expérience professionnelle</h2>
          {fields
            .filter(f => f.tag.startsWith('XP') && f.tag.length <= 4)
            .slice(0, 5)
            .map(field => {
              const entreprise = getFieldValue(field, 1);
              const poste = getFieldValue(field, 2);
              const description = getFieldValue(field, 3);
              if (!entreprise && !poste) return null;
              
              return (
                <div key={field.id} className="cv-preview-item">
                  <h3>{poste}</h3>
                  <p className="cv-preview-company">{entreprise}</p>
                  {description && <p className="cv-preview-description">{description}</p>}
                </div>
              );
            })}
        </div>

        <div className="cv-preview-section">
          <h2>Formation</h2>
          {fields
            .filter(f => f.tag.startsWith('formation'))
            .slice(0, 3)
            .map(field => {
              const diplome = getFieldValue(field, 1);
              const etablissement = getFieldValue(field, 2);
              if (!diplome && !etablissement) return null;
              
              return (
                <div key={field.id} className="cv-preview-item">
                  <h3>{diplome}</h3>
                  <p className="cv-preview-company">{etablissement}</p>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  if (embeddedMode) {
    return (
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
            <label>Langue :</label>
            <select 
              value={selectedLanguage} 
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="language-select"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
            </select>
          </div>

          <div className="control-group">
            <label>Template :</label>
            <select 
              value={selectedTemplate} 
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="template-select"
            >
              <option value="classic">Classique</option>
              <option value="modern">Moderne</option>
              <option value="minimal">Minimaliste</option>
              <option value="creative">Créatif</option>
            </select>
          </div>

          <div className="control-group">
            <label>Mode :</label>
            <div className="mode-toggle">
              <button 
                className={previewMode === 'preview' ? 'active' : ''}
                onClick={() => setPreviewMode('preview')}
              >
                Aperçu
              </button>
              <button 
                className={previewMode === 'pdf' ? 'active' : ''}
                onClick={() => setPreviewMode('pdf')}
              >
                PDF
              </button>
            </div>
          </div>

          <button 
            className="generate-pdf-button"
            onClick={handleGeneratePDF}
            disabled={isGenerating}
          >
            {isGenerating ? 'Génération...' : '📄 Générer le PDF'}
          </button>
        </div>

        <div className="cv-producer-preview">
          {previewMode === 'preview' ? (
            <div className="cv-preview-container">
              {renderCVPreview()}
            </div>
          ) : (
            <div className="cv-pdf-container">
              <p>Génération du PDF en cours...</p>
              {/* Ici on pourrait afficher le PDF généré */}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mode modal (non utilisé pour l'instant)
  return null;
};

