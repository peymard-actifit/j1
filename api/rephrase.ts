import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { 
  setCORSHeaders, 
  checkMethod, 
  checkAPIKey, 
  withRetry, 
  isRetryableError, 
  parseAPIError,
  logAPI 
} from './_utils.js';

// Mapping des codes de langue vers leurs noms
const LANGUAGE_NAMES: Record<string, string> = {
  'fr': 'français',
  'en': 'anglais',
  'es': 'espagnol',
  'de': 'allemand',
  'it': 'italien',
  'pt': 'portugais',
  'nl': 'néerlandais',
  'pl': 'polonais',
  'ru': 'russe',
  'ja': 'japonais',
  'zh': 'chinois',
  'ko': 'coréen',
  'ar': 'arabe',
  'cs': 'tchèque',
  'da': 'danois',
  'el': 'grec',
  'hu': 'hongrois',
  'id': 'indonésien',
  'nb': 'norvégien',
  'sv': 'suédois',
  'tr': 'turc',
  'uk': 'ukrainien',
};

// Styles de reformulation disponibles
type RephraseStyle = 'professional' | 'concise' | 'impactful' | 'detailed' | 'creative';

interface RephraseRequest {
  text: string;
  language?: string;
  fieldName?: string;
  context?: boolean;
  style?: RephraseStyle;
  preserveKeywords?: string[];
  maxLength?: number;
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
      text, 
      language = 'fr', 
      fieldName, 
      context,
      style = 'professional',
      preserveKeywords = [],
      maxLength
    } = req.body as RephraseRequest;

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Text is required' }
      });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!checkAPIKey(openaiApiKey, 'OPENAI', res)) return;

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const langName = LANGUAGE_NAMES[language] || language;

    // Instructions de style
    const styleInstructions: Record<RephraseStyle, string> = {
      professional: 'Utilise un ton professionnel et formel, adapté à un CV ou une lettre de motivation.',
      concise: 'Sois concis et direct. Privilégie les phrases courtes et les verbes d\'action.',
      impactful: 'Rends le texte percutant avec des verbes d\'action forts et des résultats quantifiables si possible.',
      detailed: 'Développe le texte avec plus de détails tout en restant pertinent.',
      creative: 'Sois créatif dans la formulation tout en gardant le professionnalisme.'
    };

    const systemPrompt = `Tu es un expert en rédaction professionnelle de CV et profils.

## RÈGLES IMPÉRATIVES
1. **Même langue** : Réponds UNIQUEMENT en ${langName}
2. **Même sens** : Conserve exactement les mêmes informations
3. **Reformulation pure** : Change les mots et la structure, PAS le sens
4. **Pas de traduction** : NE TRADUIS PAS, reformule seulement

## STYLE DEMANDÉ
${styleInstructions[style]}

${preserveKeywords.length > 0 ? `## MOTS-CLÉS À CONSERVER ABSOLUMENT\n${preserveKeywords.join(', ')}` : ''}

## ÉLÉMENTS À PRÉSERVER
- Dates et chiffres exacts
- Noms propres (entreprises, outils, certifications)
- Termes techniques spécifiques
- Acronymes et abréviations standards

${maxLength ? `## LONGUEUR MAXIMALE\n${maxLength} caractères environ` : ''}

${context && fieldName ? `## CONTEXTE\nCeci est le champ "${fieldName}" d'un CV professionnel.` : ''}

Réponds UNIQUEMENT avec le texte reformulé, sans guillemets, sans commentaires, sans explications.`;

    const userPrompt = text;

    // Appel à OpenAI avec retry
    const { result: response, error: apiError, retryCount } = await withRetry(
      async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Modèle rapide et économique pour la reformulation
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: Math.min(2048, Math.max(256, text.length * 2)),
          temperature: 0.7, // Un peu de créativité pour la reformulation
        });
      },
      { maxRetries: 2, baseDelayMs: 500 },
      (error) => isRetryableError(error, 'openai')
    );

    if (apiError || !response) {
      const parsedError = parseAPIError(apiError, 'openai');
      logAPI('openai', 'Rephrase failed', { error: parsedError, retryCount });
      return res.status(200).json({
        success: false,
        error: parsedError,
        rephrasedText: text // Retourner le texte original en cas d'erreur
      });
    }

    let rephrasedText = response.choices[0]?.message?.content?.trim() || text;
    
    // Nettoyer les guillemets potentiels ajoutés par GPT
    if (rephrasedText.startsWith('"') && rephrasedText.endsWith('"')) {
      rephrasedText = rephrasedText.slice(1, -1);
    }
    if (rephrasedText.startsWith('«') && rephrasedText.endsWith('»')) {
      rephrasedText = rephrasedText.slice(1, -1).trim();
    }

    const tokensUsed = response.usage?.total_tokens || 0;
    const duration = Date.now() - startTime;

    logAPI('openai', 'Rephrase completed', { 
      originalLength: text.length,
      newLength: rephrasedText.length,
      tokensUsed,
      duration,
      style
    });

    return res.status(200).json({
      success: true,
      rephrasedText,
      originalText: text,
      language,
      style,
      metrics: {
        tokensUsed,
        duration,
        retryCount,
        originalLength: text.length,
        newLength: rephrasedText.length
      }
    });

  } catch (error: any) {
    const parsedError = parseAPIError(error, 'openai');
    logAPI('openai', 'Rephrase error', { error: parsedError });
    
    return res.status(500).json({
      success: false,
      error: parsedError,
      rephrasedText: req.body?.text || ''
    });
  }
}
