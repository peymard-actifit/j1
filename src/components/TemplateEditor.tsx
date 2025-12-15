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
  cvPrompt?: string; // Prompt pour le CV
}

export const TemplateEditor = ({ 
  type, 
  file, 
  onSave, 
  onClose, 
  fields,
  selectedLanguage: _selectedLanguage, // Sera utilisé pour la génération future
  cvPrompt = ''
}: TemplateEditorProps) => {
  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [editMode, setEditMode] = useState<'text' | 'office' | 'onlyoffice' | 'wysiwyg'>('text');
  const [excelData, setExcelData] = useState<string[][]>([[]]);
  const [officeFileUrl, setOfficeFileUrl] = useState<string | null>(null);

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
      // Créer une URL temporaire pour le fichier (pour Office Online)
      const fileUrl = URL.createObjectURL(fileToLoad);
      setOfficeFileUrl(fileUrl);
      
      // Extraire aussi le contenu textuel pour le mode texte
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
              const data: string[][] = [];
              workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                sheetData.forEach((row: any) => {
                  if (Array.isArray(row)) {
                    data.push(row.map(cell => String(cell || '')));
                  }
                });
              });
              if (data.length === 0) {
                data.push(['']);
              }
              setExcelData(data);
              resolve(data.map(row => row.join('\t')).join('\n') || 'Fichier Excel vide');
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

  const initializeNewFile = async () => {
    if (type === 'excel') {
      setExcelData([['']]);
      setContent('Nouveau fichier Excel\nUtilisez les tags {tag,version} pour référencer les champs.\nExemple: {nom,1}, {prenom,1}, {email,1}');
      setFileName('nouveau_template.xlsx');
      await createEmptyFileForOffice('excel');
    } else if (type === 'word') {
      setContent('Nouveau document Word\n\nUtilisez les tags {tag,version} pour référencer les champs.\nExemple: {nom,1}, {prenom,1}, {email,1}');
      setFileName('nouveau_template.docx');
      await createEmptyFileForOffice('word');
    } else if (type === 'powerpoint') {
      setContent('Nouvelle présentation PowerPoint\n\nUtilisez les tags {tag,version} pour référencer les champs.\nExemple: {nom,1}, {prenom,1}, {email,1}');
      setFileName('nouveau_template.pptx');
      await createEmptyFileForOffice('powerpoint');
    }
  };

  const createEmptyFileForOffice = async (fileType: string) => {
    try {
      const ext = fileType === 'word' ? 'docx' : fileType === 'excel' ? 'xlsx' : 'pptx';
      const blob = await generateFile('', `nouveau_template.${ext}`, fileType);
      const fileUrl = URL.createObjectURL(blob);
      setOfficeFileUrl(fileUrl);
    } catch (err) {
      console.error('Erreur lors de la création du fichier pour Office:', err);
    }
  };

  const generateFile = async (contentToSave: string, _name: string, fileType: string): Promise<Blob> => {
    // Ajouter le prompt comme commentaire si disponible
    const promptComment = cvPrompt ? `<!-- PROMPT CV (non imprimable): ${cvPrompt} -->` : '';
    
    if (fileType === 'excel') {
      // Utiliser xlsx ou exceljs pour créer un vrai fichier Excel
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Template CV'],
        [''],
        ['Utilisez les tags {tag,version} ou {tag,IA} pour référencer les champs'],
        [''],
        ...(promptComment ? [['PROMPT CV (commentaire):', cvPrompt]] : []),
        [''],
        ...contentToSave.split('\n').map(line => [line])
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CV');
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } else if (fileType === 'word') {
      // Utiliser docx pour créer un vrai fichier Word
      const { Document, Packer, Paragraph, TextRun, CommentRangeStart, CommentRangeEnd, CommentReference } = await import('docx');
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            ...(cvPrompt ? [
              new Paragraph({
                children: [
                  new CommentRangeStart(0),
                  new TextRun({
                    text: 'PROMPT CV (non imprimable)',
                    color: 'CCCCCC', // Gris clair pour indiquer que c'est un commentaire
                    size: 8,
                  }),
                  new CommentRangeEnd(0),
                  new CommentReference(0),
                ],
              }),
            ] : []),
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
        comments: cvPrompt ? {
          children: [
            {
              id: 0,
              author: 'CV Generator',
              date: new Date(),
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cvPrompt,
                    }),
                  ],
                }),
              ],
            },
          ],
        } : undefined,
      });
      const buffer = await Packer.toBlob(doc);
      return buffer;
    } else if (fileType === 'powerpoint') {
      // Utiliser pptxgenjs pour créer un vrai fichier PowerPoint
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();
      const slide = pptx.addSlide();
      // Ajouter le prompt comme note de diapositive (non visible dans la présentation)
      if (cvPrompt) {
        slide.addNotes(cvPrompt);
      }
      contentToSave.split('\n').forEach((line, index) => {
        if (line.trim()) {
          slide.addText(line, { x: 1, y: 0.5 + index * 0.5, w: 8, h: 0.5 });
        }
      });
      const buffer = await pptx.write({ outputType: 'blob' });
      return buffer as Blob;
    }
    
    // Fallback : fichier texte
    return new Blob([contentToSave + (promptComment ? '\n' + promptComment : '')], { type: 'text/plain' });
  };


  const insertTag = (tag: string, version: number | string) => {
    const tagText = `{${tag},${version}}`;
    setContent(prev => prev + tagText);
  };

  return (
    <div className="template-editor-embedded">
      <div className="template-editor-header-embedded">
        <div className="header-left-section">
          <div className="toolbar-section-inline">
            <label>Nom du fichier:</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="file-name-input"
              placeholder="nom_du_fichier"
            />
          </div>
          <div className="toolbar-section-inline">
            <label>Insérer un tag:</label>
            <select
              className="tag-select"
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  if (value.includes(',IA')) {
                    // Tag avec IA
                    const tag = value.replace(',IA', '');
                    insertTag(tag, 'IA');
                  } else {
                    const [tag, versionStr] = value.split(',');
                    if (tag && versionStr) {
                      const version = parseInt(versionStr, 10);
                      insertTag(tag, version);
                    } else if (tag) {
                      // Pas de version spécifiée, utiliser version 1 par défaut
                      insertTag(tag, 1);
                    }
                  }
                  e.target.value = '';
                }
              }}
            >
              <option value="">Sélectionner un champ...</option>
              {fields.map(field => (
                <>
                  <option key={`${field.id}-IA`} value={`${field.tag},IA`}>
                    {field.name} - IA ({field.tag},IA)
                  </option>
                  {[1, 2, 3].map(version => (
                    <option key={`${field.id}-${version}`} value={`${field.tag},${version}`}>
                      {field.name} - Version {version} ({field.tag},{version})
                  </option>
                  ))}
                </>
              ))}
            </select>
          </div>
        </div>
        <div className="header-right-section">
          <button 
            className="mode-toggle-button" 
            onClick={() => {
              if (editMode === 'text') {
                setEditMode('office');
              } else if (editMode === 'office') {
                setEditMode('onlyoffice');
              } else if (editMode === 'onlyoffice') {
                setEditMode('wysiwyg');
              } else {
                setEditMode('text');
              }
            }}
            title="Basculer entre les modes d'édition (Texte → Office Online → OnlyOffice → WYSIWYG)"
          >
            {editMode === 'text' && '📝 Office Online'}
            {editMode === 'office' && '🔧 OnlyOffice'}
            {editMode === 'onlyoffice' && '✏️ WYSIWYG'}
            {editMode === 'wysiwyg' && '📄 Mode texte'}
          </button>
          <button 
            className="save-template-button" 
            onClick={async () => {
              try {
                const blob = await generateFile(content, fileName || `template.${type === 'word' ? 'docx' : type === 'excel' ? 'xlsx' : 'pptx'}`, type);
                const savedFile = new File([blob], fileName || `template.${type === 'word' ? 'docx' : type === 'excel' ? 'xlsx' : 'pptx'}`, {
                  type: blob.type
                });
                onSave(savedFile);
              } catch (err: any) {
                setError(`Erreur lors de la sauvegarde: ${err.message}`);
              }
            }}
            title="Sauvegarder le template"
          >
            💾 Sauvegarder
          </button>
          <button className="close-editor-button-small" onClick={onClose} title="Fermer l'éditeur">✕</button>
        </div>
      </div>
      <div className="template-editor-content-embedded">
        {error && <div className="editor-error">{error}</div>}

        {isLoading ? (
          <div className="editor-loading">Chargement...</div>
        ) : editMode === 'office' && officeFileUrl ? (
          <div className="office-online-editor">
            {type === 'word' ? (
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(officeFileUrl)}`}
                className="office-iframe"
                title="Éditeur Word Online"
                allowFullScreen
              />
            ) : type === 'excel' ? (
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(officeFileUrl)}`}
                className="office-iframe"
                title="Éditeur Excel Online"
                allowFullScreen
              />
            ) : type === 'powerpoint' ? (
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(officeFileUrl)}`}
                className="office-iframe"
                title="Éditeur PowerPoint Online"
                allowFullScreen
              />
            ) : null}
            <div className="office-editor-note">
              <p><strong>Note :</strong> Office Online nécessite que le fichier soit accessible publiquement. Pour une utilisation locale, utilisez OnlyOffice ou le mode texte.</p>
              <p>Pour utiliser Office Online avec vos fichiers locaux, vous devez :</p>
              <ul>
                <li>Héberger le fichier sur un serveur accessible publiquement (OneDrive, SharePoint, etc.)</li>
                <li>Ou utiliser OnlyOffice qui fonctionne avec des fichiers locaux</li>
              </ul>
            </div>
          </div>
        ) : editMode === 'onlyoffice' ? (
          <div className="onlyoffice-editor">
            <div className="onlyoffice-note">
              <p><strong>OnlyOffice</strong> est une solution open-source compatible avec Microsoft Office.</p>
              <p>Pour utiliser OnlyOffice, vous devez :</p>
              <ol>
                <li>Installer et configurer un serveur OnlyOffice (Document Server)</li>
                <li>Configurer l'URL du serveur dans les paramètres de l'application</li>
                <li>Le serveur OnlyOffice doit être accessible depuis votre navigateur</li>
              </ol>
              <p>Alternative : Utilisez le mode texte ou Office Online si vous avez un compte Microsoft 365.</p>
            </div>
            {/* Intégration OnlyOffice nécessite un serveur configuré */}
            {import.meta.env.VITE_ONLYOFFICE_SERVER_URL ? (
              <div className="onlyoffice-container">
                <div id="onlyoffice-editor" className="onlyoffice-iframe-container">
                  <p>Chargement de OnlyOffice...</p>
                  <p><strong>Note :</strong> OnlyOffice nécessite un serveur Document Server configuré et accessible.</p>
                  <p>Le serveur doit être configuré avec l'URL : {import.meta.env.VITE_ONLYOFFICE_SERVER_URL}</p>
                </div>
                <script
                  type="text/javascript"
                  src={`${import.meta.env.VITE_ONLYOFFICE_SERVER_URL}/web-apps/apps/api/documents/api.js`}
                />
              </div>
            ) : (
              <div className="onlyoffice-placeholder">
                <p><strong>OnlyOffice n'est pas configuré.</strong></p>
                <p>Pour utiliser OnlyOffice :</p>
                <ol>
                  <li>Installez un serveur OnlyOffice Document Server</li>
                  <li>Ajoutez <code>VITE_ONLYOFFICE_SERVER_URL</code> dans votre fichier <code>.env</code></li>
                  <li>Redémarrez l'application</li>
                </ol>
                <p><strong>Alternative :</strong> Utilisez Office Online (mode précédent) ou le mode texte pour éditer vos templates.</p>
              </div>
            )}
          </div>
        ) : editMode === 'wysiwyg' ? (
          type === 'word' ? (
            <div className="wysiwyg-editor">
              <div className="wysiwyg-toolbar">
                <button onClick={() => document.execCommand('bold')} title="Gras">B</button>
                <button onClick={() => document.execCommand('italic')} title="Italique">I</button>
                <button onClick={() => document.execCommand('underline')} title="Souligné">U</button>
                <button onClick={() => document.execCommand('justifyLeft')} title="Aligner à gauche">◀</button>
                <button onClick={() => document.execCommand('justifyCenter')} title="Centrer">⬌</button>
                <button onClick={() => document.execCommand('justifyRight')} title="Aligner à droite">▶</button>
              </div>
              <div
                className="wysiwyg-content"
                contentEditable
                dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br>') }}
                onInput={(e) => {
                  const html = e.currentTarget.innerHTML;
                  setContent(html.replace(/<br>/g, '\n').replace(/<[^>]*>/g, ''));
                }}
                style={{
                  minHeight: '400px',
                  padding: '1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
            </div>
          ) : type === 'excel' ? (
            <div className="excel-editor">
              <div className="excel-toolbar">
                <button onClick={() => {
                  setExcelData([...excelData, Array(excelData[0]?.length || 1).fill('')]);
                }}>+ Ligne</button>
                <button onClick={() => {
                  setExcelData(excelData.map(row => [...row, '']));
                }}>+ Colonne</button>
              </div>
              <table className="excel-table">
                <tbody>
                  {excelData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, colIndex) => (
                        <td key={colIndex}>
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => {
                              const newData = [...excelData];
                              newData[rowIndex][colIndex] = e.target.value;
                              setExcelData(newData);
                              setContent(newData.map(r => r.join('\t')).join('\n'));
                            }}
                            className="excel-cell"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : type === 'powerpoint' ? (
            <div className="powerpoint-editor">
              <div className="slide-editor">
                <div
                  className="slide-content"
                  contentEditable
                  dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br>') }}
                  onInput={(e) => {
                    const html = e.currentTarget.innerHTML;
                    setContent(html.replace(/<br>/g, '\n').replace(/<[^>]*>/g, ''));
                  }}
                  style={{
                    minHeight: '400px',
                    padding: '2rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                />
              </div>
            </div>
          ) : null
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

