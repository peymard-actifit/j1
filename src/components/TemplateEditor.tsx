import { useState, useEffect } from 'react';
import { UserDataField } from '../types/database';
import './TemplateEditor.css';

interface TemplateEditorProps {
  type: 'excel' | 'word' | 'powerpoint';
  file?: File | null;
  onSave: (file: File) => void;
  onClose: () => void;
  fields: UserDataField[];
  selectedLanguage: string; // Utilisé pour la génération future
}

export const TemplateEditor = ({ 
  type, 
  file, 
  onSave, 
  onClose, 
  fields,
  selectedLanguage: _selectedLanguage // Sera utilisé pour la génération future
}: TemplateEditorProps) => {
  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (file) {
      loadFile(file);
    } else {
      // Créer un nouveau fichier vide
      initializeNewFile();
    }
  }, [file, type]);

  const loadFile = async (fileToLoad: File) => {
    setIsLoading(true);
    setError('');
    try {
      const fileContent = await readFileContent(fileToLoad);
      setContent(fileContent);
      setFileName(fileToLoad.name);
    } catch (err: any) {
      setError(`Erreur lors du chargement du fichier: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const readFileContent = async (fileToRead: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else if (result instanceof ArrayBuffer) {
          // Pour les fichiers binaires, on retourne une représentation textuelle
          resolve('Fichier binaire chargé - Utilisez les outils d\'édition ci-dessous');
        } else {
          reject(new Error('Format de fichier non supporté'));
        }
      };
      reader.onerror = reject;
      
      if (type === 'excel') {
        reader.readAsArrayBuffer(fileToRead);
      } else if (type === 'word') {
        reader.readAsArrayBuffer(fileToRead);
      } else if (type === 'powerpoint') {
        reader.readAsArrayBuffer(fileToRead);
      } else {
        reader.readAsText(fileToRead);
      }
    });
  };

  const initializeNewFile = () => {
    if (type === 'excel') {
      setContent('Nouveau fichier Excel\nUtilisez les tags {tag,version} pour référencer les champs.\nExemple: {nom,1}, {prenom,1}, {email,1}');
      setFileName('nouveau_template.xlsx');
    } else if (type === 'word') {
      setContent('Nouveau document Word\n\nUtilisez les tags {tag,version} pour référencer les champs.\nExemple: {nom,1}, {prenom,1}, {email,1}');
      setFileName('nouveau_template.docx');
    } else if (type === 'powerpoint') {
      setContent('Nouvelle présentation PowerPoint\n\nUtilisez les tags {tag,version} pour référencer les champs.\nExemple: {nom,1}, {prenom,1}, {email,1}');
      setFileName('nouveau_template.pptx');
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const blob = await generateFile(content, fileName, type);
      const savedFile = new File([blob], fileName, { type: getMimeType(type) });
      onSave(savedFile);
    } catch (err: any) {
      setError(`Erreur lors de la sauvegarde: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateFile = async (contentToSave: string, _name: string, fileType: string): Promise<Blob> => {
    // Pour l'instant, on crée un fichier simple
    // Dans une implémentation complète, on utiliserait les bibliothèques spécifiques
    if (fileType === 'excel') {
      // Utiliser xlsx ou exceljs pour créer un vrai fichier Excel
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Template CV'],
        [''],
        ['Utilisez les tags {tag,version} pour référencer les champs'],
        [''],
        ...contentToSave.split('\n').map(line => [line])
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CV');
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } else if (fileType === 'word') {
      // Utiliser docx pour créer un vrai fichier Word
      const { Document, Packer, Paragraph, TextRun } = await import('docx');
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Template CV',
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: '',
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Utilisez les tags {tag,version} pour référencer les champs',
                }),
              ],
            }),
            ...contentToSave.split('\n').map(line => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: line || ' ',
                  }),
                ],
              })
            ),
          ],
        }],
      });
      const buffer = await Packer.toBlob(doc);
      return buffer;
    } else if (fileType === 'powerpoint') {
      // Utiliser pptxgenjs pour créer un vrai fichier PowerPoint
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();
      const slide = pptx.addSlide();
      slide.addText('Template CV', { x: 1, y: 0.5, w: 8, h: 0.5, fontSize: 32, bold: true });
      slide.addText('Utilisez les tags {tag,version} pour référencer les champs', { x: 1, y: 1.5, w: 8, h: 0.5 });
      contentToSave.split('\n').forEach((line, index) => {
        if (line.trim()) {
          slide.addText(line, { x: 1, y: 2 + index * 0.5, w: 8, h: 0.5 });
        }
      });
      const buffer = await pptx.write({ outputType: 'blob' });
      return buffer as Blob;
    }
    
    // Fallback : fichier texte
    return new Blob([contentToSave], { type: 'text/plain' });
  };

  const getMimeType = (fileType: string): string => {
    switch (fileType) {
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'word':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'powerpoint':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      default:
        return 'application/octet-stream';
    }
  };

  const insertTag = (tag: string, version: number) => {
    const tagText = `{${tag},${version}}`;
    setContent(prev => prev + tagText);
  };

  return (
    <div className="template-editor-embedded">
      <div className="template-editor-header-embedded">
        <h4>
          {type === 'excel' && '📊 Éditeur Excel'}
          {type === 'word' && '📝 Éditeur Word'}
          {type === 'powerpoint' && '📊 Éditeur PowerPoint'}
        </h4>
        <button className="close-editor-button-small" onClick={onClose} title="Fermer l'éditeur">✕</button>
      </div>
      <div className="template-editor-content-embedded">
          <div className="editor-toolbar">
            <div className="toolbar-section">
              <label>Nom du fichier:</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="file-name-input"
                placeholder="nom_du_fichier"
              />
            </div>
            <div className="toolbar-section">
              <label>Insérer un tag:</label>
              <select
                className="tag-select"
                onChange={(e) => {
                  const [tag, version] = e.target.value.split(',');
                  if (tag && version) {
                    insertTag(tag, parseInt(version, 10));
                    e.target.value = '';
                  }
                }}
              >
                <option value="">Sélectionner un champ...</option>
                {fields.map(field => (
                  [1, 2, 3].map(version => (
                    <option key={`${field.id}-${version}`} value={`${field.tag},${version}`}>
                      {field.name} - Version {version} ({field.tag},{version})
                    </option>
                  ))
                )).flat()}
              </select>
            </div>
          </div>

          {error && <div className="editor-error">{error}</div>}

          {isLoading ? (
            <div className="editor-loading">Chargement...</div>
          ) : (
            <div className="editor-main">
              <div className="editor-info">
                <p><strong>Instructions:</strong></p>
                <ul>
                  <li>Utilisez le format <code>{'{tag,version}'}</code> pour référencer les champs</li>
                  <li>Exemples: <code>{'{nom,1}'}</code>, <code>{'{prenom,1}'}</code>, <code>{'{email,1}'}</code></li>
                  <li>Vous pouvez insérer des tags via le menu déroulant ci-dessus</li>
                  <li>Pour Excel: chaque ligne correspond à une ligne du tableur</li>
                  <li>Pour Word: le texte sera formaté comme un document</li>
                  <li>Pour PowerPoint: le contenu sera ajouté à la première diapositive</li>
                </ul>
              </div>
              <textarea
                className="editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Contenu du template..."
                rows={15}
              />
            </div>
          )}

          <div className="editor-actions">
            <button className="save-button" onClick={handleSave} disabled={isLoading || !fileName}>
              💾 Sauvegarder
            </button>
            <button className="cancel-button" onClick={onClose}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

