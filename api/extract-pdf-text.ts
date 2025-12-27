import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { 
  setCORSHeaders, 
  checkMethod,
  withRetry, 
  isRetryableError, 
  parseAPIError,
  logAPI 
} from './lib/api-utils';

/**
 * API d'extraction de texte de PDF
 * 
 * Stratégie en cascade:
 * 1. Le client essaie d'abord pdf.js côté navigateur
 * 2. Si le texte est insuffisant, cette API utilise OpenAI Vision pour OCR intelligent
 * 3. Documint n'est plus utilisé (API incorrecte pour l'extraction)
 */

interface ExtractRequest {
  fileContent?: string;     // Base64 du PDF (pour legacy)
  imageBase64?: string;     // Image du PDF (pour OCR Vision)
  existingText?: string;    // Texte déjà extrait par pdf.js
  extractionMode?: 'ocr' | 'enhance' | 'full';
  language?: string;
}

interface ExtractResult {
  text: string;
  confidence: number;
  method: 'pdf.js' | 'vision-ocr' | 'vision-enhance' | 'hybrid';
  sections?: {
    type: 'header' | 'contact' | 'experience' | 'education' | 'skills' | 'other';
    content: string;
  }[];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCORSHeaders(res);
  if (!checkMethod(req, res, ['POST'])) return;

  const startTime = Date.now();

  try {
    const { 
      fileContent,
      imageBase64, 
      existingText,
      extractionMode = 'enhance',
      language = 'fr'
    } = req.body as ExtractRequest;

    // Cas 1: On a déjà du texte de pdf.js qui semble correct
    if (existingText && existingText.trim().length > 200 && extractionMode !== 'full') {
      // Le texte pdf.js est suffisant, on le retourne directement
      logAPI('extract', 'Using existing pdf.js text', { textLength: existingText.length });
      return res.status(200).json({
        success: true,
        text: existingText,
        confidence: 0.9,
        method: 'pdf.js'
      });
    }

    // Cas 2: On a une image pour OCR via OpenAI Vision
    if (imageBase64) {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        logAPI('extract', 'No OpenAI API key for Vision OCR');
        return res.status(200).json({
          success: false,
          error: 'OPENAI_API_KEY non configurée pour OCR',
          text: existingText || '',
          method: 'none'
        });
      }

      const openai = new OpenAI({ apiKey: openaiApiKey });

      logAPI('extract', 'Starting Vision OCR', { 
        hasExistingText: !!existingText,
        existingTextLength: existingText?.length || 0,
        mode: extractionMode
      });

      // Prompt adapté selon le mode
      const prompts: Record<string, string> = {
        ocr: `Tu es un OCR expert. Extrait TOUT le texte visible dans cette image de CV.
              Conserve la structure (titres, paragraphes, listes).
              Retourne le texte brut sans formatage markdown.`,
        
        enhance: `Tu es un expert en lecture de CV. Cette image est un CV.
                  ${existingText ? `Texte déjà extrait (peut être incomplet): ${existingText.substring(0, 2000)}` : ''}
                  
                  Ta mission:
                  1. Lis TOUT le texte visible dans l'image
                  2. Corrige les erreurs d'OCR du texte existant
                  3. Ajoute tout texte manquant
                  4. Conserve la structure logique du CV
                  
                  Retourne le texte complet et corrigé du CV.`,
        
        full: `Tu es un OCR parfait pour les CV professionnels.
               Extrait ABSOLUMENT TOUT le texte visible:
               - Nom, prénom, coordonnées
               - Titres et sous-titres
               - Expériences professionnelles (dates, entreprises, postes, missions)
               - Formations et diplômes
               - Compétences (techniques, langues, soft skills)
               - Certifications
               - Tout autre contenu textuel
               
               Conserve la structure et l'ordre du document.
               Retourne le texte brut complet.`
      };

      const { result: response, error: apiError, retryCount } = await withRetry(
        async () => {
          return await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompts[extractionMode] || prompts.enhance },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`,
                      detail: 'high'
                    }
                  }
                ]
              }
            ],
            max_tokens: 4096,
            temperature: 0.1, // Très faible pour OCR précis
          });
        },
        { maxRetries: 2, baseDelayMs: 1000 },
        (error) => isRetryableError(error, 'openai')
      );

      if (apiError || !response) {
        const parsedError = parseAPIError(apiError, 'openai');
        logAPI('extract', 'Vision OCR failed', { error: parsedError, retryCount });
        
        return res.status(200).json({
          success: false,
          error: parsedError,
          text: existingText || '',
          method: 'vision-ocr'
        });
      }

      const extractedText = response.choices[0]?.message?.content?.trim() || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      const duration = Date.now() - startTime;

      // Déterminer la méthode utilisée
      const method: ExtractResult['method'] = existingText && extractedText 
        ? 'hybrid' 
        : 'vision-ocr';

      // Si on avait du texte existant, fusionner intelligemment
      let finalText = extractedText;
      if (existingText && extractedText) {
        // Utiliser le texte Vision car il est généralement plus complet et mieux structuré
        // mais on pourrait implémenter une fusion plus intelligente
        finalText = extractedText;
      }

      logAPI('extract', 'Vision OCR completed', { 
        textLength: finalText.length,
        tokensUsed,
        duration,
        method
      });

      return res.status(200).json({
        success: true,
        text: finalText,
        confidence: 0.95,
        method,
        metrics: {
          tokensUsed,
          duration,
          retryCount
        }
      });
    }

    // Cas 3: Ancien format avec fileContent base64 (legacy - pas d'extraction côté serveur sans image)
    if (fileContent) {
      logAPI('extract', 'Legacy fileContent without image - returning empty', { 
        fileContentLength: fileContent.length 
      });
      
      // On ne peut plus extraire sans l'image ou sans que le client utilise pdf.js
      return res.status(200).json({
        success: false,
        error: 'Pour l\'extraction de texte, utilisez pdf.js côté client ou envoyez une image du PDF',
        text: '',
        method: 'none'
      });
    }

    // Aucune donnée fournie
    return res.status(400).json({
      success: false,
      error: 'imageBase64 ou existingText requis'
    });

  } catch (error: any) {
    const parsedError = parseAPIError(error, 'internal');
    logAPI('extract', 'Extraction error', { error: parsedError });
    
    return res.status(500).json({
      success: false,
      error: parsedError,
      text: ''
    });
  }
}
