import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  setCORSHeaders, 
  checkMethod, 
  checkAPIKey, 
  withRetry, 
  isRetryableError, 
  parseAPIError,
  logAPI 
} from './lib/api-utils';

// Mapping des codes de langue pour DeepL
const DEEPL_LANG_MAP: Record<string, string> = {
  'en': 'EN',
  'en-us': 'EN-US',
  'en-gb': 'EN-GB',
  'fr': 'FR',
  'de': 'DE',
  'es': 'ES',
  'it': 'IT',
  'pt': 'PT-PT',
  'pt-br': 'PT-BR',
  'nl': 'NL',
  'pl': 'PL',
  'ru': 'RU',
  'ja': 'JA',
  'zh': 'ZH',
  'ko': 'KO',
  'ar': 'AR',
  'cs': 'CS',
  'da': 'DA',
  'el': 'EL',
  'hu': 'HU',
  'id': 'ID',
  'nb': 'NB',
  'sv': 'SV',
  'tr': 'TR',
  'uk': 'UK',
  'fi': 'FI',
  'ro': 'RO',
  'sk': 'SK',
  'sl': 'SL',
  'bg': 'BG',
  'et': 'ET',
  'lv': 'LV',
  'lt': 'LT',
};

// Types de formalité supportés
type Formality = 'default' | 'more' | 'less' | 'prefer_more' | 'prefer_less';

interface TranslateRequest {
  text: string | string[];  // Support batch translation
  targetLang: string;
  sourceLang?: string;
  formality?: Formality;
  preserveFormatting?: boolean;
  splitSentences?: '0' | '1' | 'nonewlines';
  tagHandling?: 'xml' | 'html';
  context?: string;  // Contexte pour améliorer la traduction
}

interface TranslateResponse {
  translatedText: string | string[];
  detectedSourceLang?: string;
  charactersUsed?: number;
  isBatch?: boolean;
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
      targetLang, 
      sourceLang,
      formality = 'default',
      preserveFormatting = true,
      splitSentences = '1',
      tagHandling,
      context
    } = req.body as TranslateRequest;

    // Validation des entrées
    if (!text || (Array.isArray(text) ? text.length === 0 : !text.trim())) {
      return res.status(400).json({ 
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Text is required' }
      });
    }

    if (!targetLang) {
      return res.status(400).json({ 
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Target language is required' }
      });
    }

    const deeplApiKey = process.env.DEEPL_API_KEY;
    
    if (!deeplApiKey) {
      // Pas de clé API, retourner le texte original avec un warning
      logAPI('deepl', 'No API key configured');
      return res.status(200).json({ 
        success: true,
        translatedText: text,
        warning: 'Translation API not configured, returning original text'
      });
    }

    // Déterminer l'URL de l'API (free vs pro)
    const deeplUrl = deeplApiKey.endsWith(':fx') 
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    // Mapper les codes de langue
    const targetLangDeepL = DEEPL_LANG_MAP[targetLang.toLowerCase()] || targetLang.toUpperCase();
    const sourceLangDeepL = sourceLang 
      ? (DEEPL_LANG_MAP[sourceLang.toLowerCase()] || sourceLang.toUpperCase()) 
      : undefined;

    // Préparer les textes pour batch translation
    const texts = Array.isArray(text) ? text : [text];
    const isBatch = Array.isArray(text);

    logAPI('deepl', 'Starting translation', { 
      textsCount: texts.length,
      targetLang: targetLangDeepL,
      sourceLang: sourceLangDeepL,
      formality,
      isBatch
    });

    // Construire les paramètres
    const params = new URLSearchParams();
    params.append('auth_key', deeplApiKey);
    texts.forEach(t => params.append('text', t));
    params.append('target_lang', targetLangDeepL);
    
    if (sourceLangDeepL) {
      params.append('source_lang', sourceLangDeepL);
    }
    
    // Formalité (uniquement pour certaines langues)
    const formalityLanguages = ['DE', 'FR', 'IT', 'ES', 'NL', 'PL', 'PT-PT', 'PT-BR', 'RU', 'JA'];
    if (formality !== 'default' && formalityLanguages.includes(targetLangDeepL)) {
      params.append('formality', formality);
    }
    
    // Préservation du formatage
    if (preserveFormatting) {
      params.append('preserve_formatting', '1');
    }
    
    // Gestion des phrases
    params.append('split_sentences', splitSentences);
    
    // Gestion des tags
    if (tagHandling) {
      params.append('tag_handling', tagHandling);
    }
    
    // Contexte (pour améliorer la traduction)
    if (context) {
      params.append('context', context);
    }

    // Appel à l'API DeepL avec retry
    const { result: response, error: apiError, retryCount } = await withRetry(
      async () => {
        const fetchResponse = await fetch(deeplUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          const error = new Error(`DeepL API error: ${fetchResponse.status} - ${errorText}`);
          (error as any).status = fetchResponse.status;
          throw error;
        }

        return fetchResponse.json();
      },
      { maxRetries: 3, baseDelayMs: 500 },
      (error) => isRetryableError(error, 'deepl')
    );

    if (apiError || !response) {
      const parsedError = parseAPIError(apiError, 'deepl');
      logAPI('deepl', 'Translation failed', { error: parsedError, retryCount });
      
      // En cas d'erreur, retourner le texte original
      return res.status(200).json({ 
        success: false,
        translatedText: text,
        error: parsedError
      });
    }

    // Extraire les traductions
    const translations = response.translations || [];
    const translatedTexts = translations.map((t: any) => t.text);
    const detectedSourceLang = translations[0]?.detected_source_language;
    
    // Calculer les caractères utilisés
    const charactersUsed = texts.reduce((acc: number, t: string) => acc + t.length, 0);
    
    const duration = Date.now() - startTime;

    logAPI('deepl', 'Translation completed', { 
      textsCount: texts.length,
      charactersUsed,
      duration,
      retryCount,
      detectedSourceLang
    });

    const result: TranslateResponse = {
      translatedText: isBatch ? translatedTexts : translatedTexts[0] || text,
      detectedSourceLang,
      charactersUsed,
      isBatch
    };

    return res.status(200).json({
      success: true,
      ...result,
      metrics: {
        duration,
        retryCount,
        charactersUsed
      }
    });

  } catch (error: any) {
    const parsedError = parseAPIError(error, 'deepl');
    logAPI('deepl', 'Translation error', { error: parsedError });
    
    return res.status(200).json({ 
      success: false,
      translatedText: req.body?.text || '',
      error: parsedError
    });
  }
}
