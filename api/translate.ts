import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Ajouter les headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, targetLang, sourceLang } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Text and target language are required' });
    }

    // Vérifier si la clé DeepL est configurée
    const deeplApiKey = process.env.DEEPL_API_KEY;
    
    if (!deeplApiKey) {
      // Si pas de clé API, retourner le texte original
      console.warn('DEEPL_API_KEY not configured, returning original text');
      return res.status(200).json({ 
        translatedText: text,
        warning: 'Translation API not configured'
      });
    }

    // Mapper les codes de langue pour DeepL
    const deeplLangMap: Record<string, string> = {
      'en': 'EN',
      'fr': 'FR',
      'de': 'DE',
      'es': 'ES',
      'it': 'IT',
      'pt': 'PT-PT',
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
    };

    const targetLangDeepL = deeplLangMap[targetLang.toLowerCase()] || targetLang.toUpperCase();
    const sourceLangDeepL = sourceLang ? (deeplLangMap[sourceLang.toLowerCase()] || sourceLang.toUpperCase()) : undefined;

    // Appeler l'API DeepL
    const deeplUrl = deeplApiKey.endsWith(':fx') 
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const params = new URLSearchParams({
      auth_key: deeplApiKey,
      text: text,
      target_lang: targetLangDeepL,
    });

    if (sourceLangDeepL) {
      params.append('source_lang', sourceLangDeepL);
    }

    const response = await fetch(deeplUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepL API error:', errorText);
      return res.status(200).json({ 
        translatedText: text,
        error: 'Translation failed'
      });
    }

    const data = await response.json();
    const translatedText = data.translations?.[0]?.text || text;

    return res.status(200).json({ translatedText });

  } catch (error: any) {
    console.error('Error in translate API:', error);
    return res.status(200).json({ 
      translatedText: req.body?.text || '',
      error: error.message || 'Translation error'
    });
  }
}
