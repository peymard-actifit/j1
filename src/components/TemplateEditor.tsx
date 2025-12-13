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
      reader.onload = async (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else if (result instanceof ArrayBuffer) {
          try {
            // Extraire le contenu textuel selon le type de fichier
            if (type === 'word') {
              // Utiliser mammoth pour extraire le texte des fichiers Word
              const mammoth = await import('mammoth');
              const extractResult = await mammoth.extractRawText({ arrayBuffer: result });
              resolve(extractResult.value || 'Document Word vide');
            } else if (type === 'excel') {
              const XLSX = await import('xlsx');
              const workbook = XLSX.read(result, { type: 'array' });
              const lines: string[] = [];
              workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                data.forEach((row: any) => {
                  if (Array.isArray(row)) {
                    lines.push(row.join('\t'));
                  }
                });
              });
              resolve(lines.join('\n') || 'Fichier Excel vide');
            } else if (type === 'powerpoint') {
              // Pour PowerPoint, on utilise une approche simplifiée
              // Note: pptxgenjs ne peut pas lire les fichiers, seulement les créer
              // On va utiliser une bibliothèque de lecture si disponible, sinon on affiche un message
              resolve('Fichier PowerPoint chargé - Le contenu sera recréé lors de la sauvegarde\nUtilisez les tags {tag,version} pour référencer les champs.');
            } else {
              resolve('Fichier binaire chargé - Utilisez les outils d\'édition ci-dessous');
            }
          } catch (err: any) {
            reject(new Error(`Erreur lors de l'extraction du contenu: ${err.message}`));
          }
        } else {
          reject(new Error('Format de fichier non supporté'));
        }
      };
      reader.onerror = reject;
      
      if (type === 'excel' || type === 'word' || type === 'powerpoint') {
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
        <div className="header-left-section">
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
        <div className="header-right-section">
          <button className="save-button" onClick={handleSave} disabled={isLoading || !fileName} title="Sauvegarder sous">
            💾 Sauvegarder sous
          </button>
          <button className="close-editor-button-small" onClick={onClose} title="Fermer l'éditeur">✕</button>
        </div>
      </div>
      <div className="template-editor-content-embedded">
        {error && <div className="editor-error">{error}</div>}

        {isLoading ? (
          <div className="editor-loading">Chargement...</div>
        ) : (
          <textarea
            className="editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Contenu du template..."
            rows={15}
          />
        )}
      </div>
    </div>
  );
};

