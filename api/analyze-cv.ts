import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

interface FieldDefinition {
  id: string;
  name: string;
  tag: string;
  type: string;
  description?: string;
}

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
    const { 
      textContent, 
      imageBase64, 
      existingFields, 
      extractImages = true 
    } = req.body;

    if (!textContent && !imageBase64) {
      return res.status(400).json({ error: 'Text content or image is required' });
    }

    // Vérifier si la clé OpenAI est configurée
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return res.status(200).json({ 
        success: false,
        error: 'OPENAI_API_KEY non configurée',
        extractedData: [],
        images: []
      });
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Construire le prompt pour l'analyse
    const existingFieldsList = existingFields?.map((f: FieldDefinition) => 
      `- ${f.tag}: ${f.name} (${f.type})`
    ).join('\n') || '';

    const systemPrompt = `Tu es un expert en analyse de CV. Tu dois extraire TOUTES les informations d'un CV de manière exhaustive et les mapper vers des champs structurés.

CHAMPS EXISTANTS (à utiliser en priorité si le contenu correspond):
${existingFieldsList || 'Aucun champ existant'}

RÈGLES D'EXTRACTION:
1. Extrait TOUTES les informations présentes dans le CV, même les plus petites
2. Utilise les tags existants quand le contenu correspond (même partiellement)
3. Crée de nouveaux tags pour les informations qui ne correspondent à aucun champ existant
4. Les nouveaux tags doivent suivre le format: PascalCase sans accents (ex: ExperienceProfessionnelle01)
5. Pour les expériences multiples (XP01, XP02...), identifie et numérote correctement
6. Extrais les dates, durées, entreprises, postes, missions, résultats séparément
7. Pour chaque donnée, indique un score de confiance entre 0 et 1

CATÉGORIES DE DONNÉES À EXTRAIRE:
- Identité: nom, prénom, adresse, téléphone, email, date/lieu de naissance
- Objectif: poste recherché, intitulés alternatifs
- Résumé: profil, accroche, pitch
- Compétences: techniques, métier, soft skills, langues
- Expériences professionnelles: pour chaque XP (période, durée, entreprise, secteur, poste, contexte, mission, résultats, outils)
- Formations: initiales et continues
- Certifications
- Langues et niveaux
- Publications, présentations
- Associations, bénévolat
- Loisirs, centres d'intérêt
- Références

FORMAT DE RÉPONSE (JSON):
{
  "extractedData": [
    {
      "tag": "NOM",
      "name": "Nom",
      "value": "DUPONT",
      "confidence": 0.95,
      "isNew": false,
      "suggestedType": "text"
    },
    ...
  ],
  "images": [
    {
      "description": "Photo d'identité professionnelle",
      "type": "photo",
      "suggestedTag": "PhotoIdentite"
    },
    ...
  ],
  "summary": "Résumé de l'analyse...",
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`;

    const userPrompt = `Analyse ce CV et extrait TOUTES les informations de manière exhaustive.

CONTENU DU CV:
${textContent || '(Pas de contenu texte, analyser l\'image uniquement)'}

${extractImages ? 'Identifie également tous les éléments visuels (photos, logos, graphiques, frises chronologiques, icônes).' : ''}

Réponds uniquement en JSON valide.`;

    let response;
    
    if (imageBase64) {
      // Utiliser GPT-4 Vision pour analyser l'image + texte
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
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
        max_tokens: 4096,
        temperature: 0.1,
      });
    } else {
      // Utiliser GPT-4 pour analyser uniquement le texte
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });
    }

    const aiResponse = response.choices[0]?.message?.content || '';
    
    // Parser la réponse JSON
    let parsedResponse;
    try {
      // Nettoyer la réponse (enlever les backticks markdown si présents)
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      
      parsedResponse = JSON.parse(cleanedResponse.trim());
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response:', aiResponse);
      
      // Essayer d'extraire le JSON du texte
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch {
          return res.status(200).json({
            success: false,
            error: 'Erreur lors du parsing de la réponse IA',
            rawResponse: aiResponse,
            extractedData: [],
            images: []
          });
        }
      } else {
        return res.status(200).json({
          success: false,
          error: 'Réponse IA invalide',
          rawResponse: aiResponse,
          extractedData: [],
          images: []
        });
      }
    }

    return res.status(200).json({
      success: true,
      extractedData: parsedResponse.extractedData || [],
      images: parsedResponse.images || [],
      summary: parsedResponse.summary || '',
      suggestions: parsedResponse.suggestions || [],
      tokensUsed: response.usage?.total_tokens || 0
    });

  } catch (error: any) {
    console.error('Error analyzing CV:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'analyse du CV',
      extractedData: [],
      images: []
    });
  }
}
