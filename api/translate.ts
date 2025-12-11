import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as deepl from 'deepl-node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, targetLang, sourceLang } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!targetLang) {
      return res.status(400).json({ error: 'Target language is required' });
    }

    const authKey = process.env.DEEPL_API_KEY;
    if (!authKey) {
      return res.status(500).json({ error: 'DEEPL_API_KEY not configured' });
    }

    const translator = new deepl.Translator(authKey);

    // Convertir le code langue au format DeepL
    const targetLangCode = convertToDeepLLangCode(targetLang);
    const sourceLangCode = sourceLang ? convertToDeepLLangCode(sourceLang) : null;

    const result = await translator.translateText(
      text,
      sourceLangCode || null,
      targetLangCode
    );

    // Gérer le cas où result est un tableau ou un objet unique
    const translatedText = Array.isArray(result) ? result[0].text : result.text;
    const detectedLang = Array.isArray(result) ? result[0].detectedSourceLang : result.detectedSourceLang;

    return res.status(200).json({
      success: true,
      text: translatedText,
      detectedSourceLang: detectedLang,
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la traduction',
    });
  }
}

// Fonction pour convertir les codes de langue au format DeepL
function convertToDeepLLangCode(lang: string): deepl.TargetLanguageCode {
  const langMap: Record<string, deepl.TargetLanguageCode | deepl.SourceLanguageCode> = {
    'fr': 'fr',
    'en': 'en-US',
    'es': 'es',
    'de': 'de',
    'it': 'it',
    'pt': 'pt-PT',
    'nl': 'nl',
    'pl': 'pl',
    'ru': 'ru',
    'ja': 'ja',
    'zh': 'zh',
    'ko': 'ko',
    'ar': 'ar',
    'cs': 'cs',
    'da': 'da',
    'el': 'el',
    'hu': 'hu',
    'id': 'id',
    'nb': 'nb',
    'sv': 'sv',
    'tr': 'tr',
    'uk': 'uk',
  };

  const normalizedLang = lang.toLowerCase().split('-')[0];
  return langMap[normalizedLang] || 'en-US';
}

