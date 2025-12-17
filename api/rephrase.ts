import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

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
    const { text, language = 'fr', fieldName, context } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Vérifier si la clé OpenAI est configurée
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return res.status(200).json({ 
        success: false,
        error: 'OPENAI_API_KEY non configurée',
        rephrasedText: text
      });
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Mapping des codes de langue vers leurs noms
    const languageNames: Record<string, string> = {
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

    const langName = languageNames[language] || language;

    const systemPrompt = `Tu es un expert en rédaction de CV et de profils professionnels.
Tu dois reformuler le texte fourni en ${langName}, en gardant le même sens mais avec des mots différents.

RÈGLES IMPORTANTES:
1. Conserve la MÊME langue (${langName})
2. Conserve le MÊME sens et les mêmes informations
3. Utilise des synonymes et une structure de phrase différente
4. Garde le même niveau de professionnalisme
5. Ne traduis PAS, reformule seulement
6. Conserve la même longueur approximative
7. Si le texte contient des dates, chiffres, noms propres ou termes techniques, conserve-les à l'identique
8. Adapte le style pour qu'il soit plus percutant et professionnel si possible

${context ? `CONTEXTE: Il s'agit du champ "${fieldName}" d'un CV.` : ''}

Réponds UNIQUEMENT avec le texte reformulé, sans explication ni commentaire.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const rephrasedText = response.choices[0]?.message?.content?.trim() || text;

    return res.status(200).json({
      success: true,
      rephrasedText,
      originalText: text,
      language,
      tokensUsed: response.usage?.total_tokens || 0
    });

  } catch (error: any) {
    console.error('Error rephrasing text:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la reformulation',
      rephrasedText: req.body?.text || ''
    });
  }
}
