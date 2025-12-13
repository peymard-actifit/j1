import { useState } from 'react';
import { analyzeCVFile } from '../utils/ai';
import './CVUpload.css';

interface CVUploadProps {
  onAnalysisComplete: (data: any) => void;
  onCancel: () => void;
}

export const CVUpload = ({ onAnalysisComplete, onCancel }: CVUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError('');
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const analysis = await analyzeCVFile(file);
      onAnalysisComplete(analysis);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'analyse du CV');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="cv-upload">
      <div className="cv-upload-content">
        <h2>Importer votre CV</h2>
        <p className="cv-upload-description">
          Formats acceptés : PDF, Word, LaTeX, Excel, PowerPoint
        </p>

        <div className="cv-upload-form">
          <div className="file-input-wrapper">
            <input
              type="text"
              placeholder="Nom du fichier"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="file-name-input"
            />
            <label className="file-upload-label">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.tex,.xls,.xlsx,.ppt,.pptx"
                onChange={handleFileChange}
                className="file-input"
              />
              <span className="file-upload-button">Choisir un fichier</span>
            </label>
          </div>

          {file && (
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">
                {(file.size / 1024).toFixed(2)} KB
              </span>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="cv-upload-actions">
            <button
              onClick={onCancel}
              className="button-secondary"
              disabled={uploading}
            >
              Annuler
            </button>
            <button
              onClick={handleAnalyze}
              className="button-primary"
              disabled={!file || uploading}
            >
              {uploading ? 'Analyse en cours...' : 'Analyser avec IA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};









