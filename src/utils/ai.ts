// Utilitaires pour l'API OpenAI via les fonctions serverless Vercel

import { api } from './api';

export const analyzeCVFile = async (file: File): Promise<any> => {
  // Lire le contenu du fichier
  const fileContent = await readFileContent(file);
  
  // Appeler l'API serverless pour l'analyse
  const result = await api.analyzeCV(
    fileContent,
    file.name,
    file.type
  );

  if (!result.success) {
    throw new Error(result.error || 'Erreur lors de l\'analyse du CV');
  }

  return result.data;
};

const readFileContent = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = reject;
    
    if (file.type === 'application/pdf') {
      // Pour les PDF, on lit en base64
      reader.readAsDataURL(file);
    } else {
      // Pour les autres formats, on lit en texte
      reader.readAsText(file);
    }
  });
};

export const callAI = async (
  type: string,
  input: any,
  userId: string,
  userData?: any
): Promise<any> => {
  const result = await api.callAI(type, input, userId, userData);

  if (!result.success) {
    throw new Error(result.error || 'Erreur lors de l\'appel IA');
  }

  return result.data;
};
