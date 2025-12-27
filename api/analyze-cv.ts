import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { 
  setCORSHeaders, 
  checkMethod, 
  checkAPIKey, 
  withRetry, 
  isRetryableError, 
  parseAPIError,
  safeJSONParse,
  logAPI
} from './_utils.js';

interface FieldDefinition {
  id: string;
  name: string;
  tag: string;
  type: string;
  description?: string;
}

interface ExtractedField {
  tag: string;
  name: string;
  value: string;
  confidence: number;
  isNew: boolean;
  suggestedType: string;
  category?: string;
}

interface ExtractedImage {
  description: string;
  type: 'photo' | 'logo' | 'chart' | 'timeline' | 'icon' | 'other';
  suggestedTag?: string;
  location?: string;
}

interface CVAnalysisResult {
  extractedData: ExtractedField[];
  images: ExtractedImage[];
  summary: string;
  suggestions: string[];
  rawTextQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  detectedLanguage?: string;
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
      textContent, 
      imageBase64, 
      existingFields, 
      extractImages = true,
      analysisDepth = 'full' // 'quick' | 'full' | 'deep'
    } = req.body;

    if (!textContent && !imageBase64) {
      return res.status(400).json({ 
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Text content or image is required' }
      });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!checkAPIKey(openaiApiKey, 'OPENAI', res)) return;

    logAPI('openai', 'Starting CV analysis', { 
      hasText: !!textContent, 
      hasImage: !!imageBase64,
      analysisDepth 
    });

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Construire la liste des champs existants de manière concise
    const existingFieldsList = existingFields?.length > 0
      ? existingFields.map((f: FieldDefinition) => `${f.tag}: ${f.name} (${f.type})`).join('\n')
      : 'Aucun champ existant - créer de nouveaux tags';

    // Prompt système optimisé avec instructions claires
    const systemPrompt = `Tu es un expert en extraction de données de CV. Tu analyses avec précision et exhaustivité.

## CHAMPS EXISTANTS (à utiliser en priorité)
${existingFieldsList}

## RÈGLES D'EXTRACTION
1. **Priorité aux tags existants** : Utilise les tags ci-dessus quand le contenu correspond
2. **Nouveaux tags** : Format PascalCase sans accents (ex: ExperiencePro01, CompetenceTech02)
3. **Numérotation** : Pour les éléments multiples, utilise 01, 02, 03...
4. **Confiance** : Score de 0.0 à 1.0 basé sur la clarté de l'information
5. **Catégories** : identity, contact, objective, summary, skills, experience, education, languages, certifications, other

## CATÉGORIES À EXTRAIRE
- **Identité** : nom, prénom, titre, date/lieu naissance
- **Contact** : email, téléphone, adresse, LinkedIn, site web
- **Objectif** : poste recherché, intitulés alternatifs
- **Résumé** : profil, accroche, pitch
- **Compétences** : techniques (outils, langages), métier, soft skills
- **Expériences** : pour chaque XP → période, durée, entreprise, secteur, poste, contexte, missions, résultats
- **Formations** : diplômes, certifications, formations continues
- **Langues** : langue + niveau (A1-C2 ou natif/courant/intermédiaire/débutant)

Réponds UNIQUEMENT en JSON valide selon le schéma ci-dessous.`;

    const userPrompt = `Analyse ce CV de manière ${analysisDepth === 'deep' ? 'très approfondie' : analysisDepth === 'quick' ? 'rapide mais complète' : 'complète'}.

${textContent ? `## CONTENU TEXTUEL DU CV\n${textContent.substring(0, 15000)}` : '(Pas de contenu texte, analyser l\'image)'}

${extractImages && imageBase64 ? '## Identifie également les éléments visuels (photo, logos, graphiques).' : ''}

Retourne un JSON avec cette structure exacte:
{
  "extractedData": [
    { "tag": "NOM", "name": "Nom", "value": "DUPONT", "confidence": 0.95, "isNew": false, "suggestedType": "text", "category": "identity" }
  ],
  "images": [
    { "description": "Photo professionnelle", "type": "photo", "suggestedTag": "PhotoIdentite", "location": "haut gauche" }
  ],
  "summary": "Profil de développeur senior avec 10 ans d'expérience...",
  "suggestions": ["Ajouter des mots-clés techniques", "Quantifier les résultats"],
  "rawTextQuality": "good",
  "detectedLanguage": "fr"
}`;

    // Sélection du modèle selon la complexité
    const model = imageBase64 ? 'gpt-4o' : (analysisDepth === 'quick' ? 'gpt-4o-mini' : 'gpt-4o');

    // Appel à OpenAI avec retry
    const { result: response, error: apiError, retryCount } = await withRetry(
      async () => {
        if (imageBase64) {
          return await openai.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
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
            max_tokens: analysisDepth === 'deep' ? 8000 : 4096,
            temperature: 0.1,
            response_format: { type: "json_object" }
          });
        } else {
          return await openai.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: analysisDepth === 'deep' ? 8000 : 4096,
            temperature: 0.1,
            response_format: { type: "json_object" }
          });
        }
      },
      { maxRetries: 2, baseDelayMs: 1000 },
      (error) => isRetryableError(error, 'openai')
    );

    if (apiError || !response) {
      const parsedError = parseAPIError(apiError, 'openai');
      logAPI('openai', 'Analysis failed', { error: parsedError, retryCount });
      return res.status(200).json({
        success: false,
        error: parsedError,
        extractedData: [],
        images: []
      });
    }

    const aiResponse = response.choices[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;
    
    // Parser la réponse JSON
    const { success: parseSuccess, data: parsedResponse, error: parseError } = safeJSONParse<CVAnalysisResult>(aiResponse);

    if (!parseSuccess || !parsedResponse) {
      logAPI('openai', 'JSON parse failed', { parseError, rawResponse: aiResponse.substring(0, 500) });
      return res.status(200).json({
        success: false,
        error: {
          code: 'PARSING_ERROR',
          message: 'Erreur lors du parsing de la réponse IA',
          details: parseError,
          retryable: false,
          provider: 'openai'
        },
        rawResponse: aiResponse,
        extractedData: [],
        images: []
      });
    }

    // Valider et enrichir les données extraites
    const validatedData = (parsedResponse.extractedData || []).map(item => ({
      ...item,
      confidence: Math.min(1, Math.max(0, item.confidence || 0.5)),
      isNew: existingFields ? !existingFields.some((f: FieldDefinition) => 
        f.tag.toLowerCase() === item.tag.toLowerCase()
      ) : true,
      suggestedType: item.suggestedType || 'text'
    }));

    const duration = Date.now() - startTime;
    
    logAPI('openai', 'Analysis completed', { 
      fieldsExtracted: validatedData.length,
      imagesFound: (parsedResponse.images || []).length,
      tokensUsed,
      duration,
      retryCount
    });

    return res.status(200).json({
      success: true,
      extractedData: validatedData,
      images: parsedResponse.images || [],
      summary: parsedResponse.summary || '',
      suggestions: parsedResponse.suggestions || [],
      rawTextQuality: parsedResponse.rawTextQuality,
      detectedLanguage: parsedResponse.detectedLanguage,
      metrics: {
        tokensUsed,
        duration,
        retryCount,
        model
      }
    });

  } catch (error: any) {
    const parsedError = parseAPIError(error, 'openai');
    logAPI('openai', 'Unexpected error', { error: parsedError });
    
    return res.status(500).json({
      success: false,
      error: parsedError,
      extractedData: [],
      images: []
    });
  }
}
