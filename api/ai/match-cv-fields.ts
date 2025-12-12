import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface UserField {
  id: string;
  name: string;
  tag: string;
  type: string;
  baseLanguage: string;
  aiVersions?: Array<{ version: number; value: string }>;
  languageVersions?: Array<{ language: string; version: number; value: string }>;
}

interface ExtractedData {
  [key: string]: any;
}

interface FieldMatch {
  extractedKey: string;
  extractedValue: string;
  fieldId: string;
  fieldName: string;
  fieldTag: string;
  confidence: number; // 0-100
  reason: string; // Explication du matching
  targetVersion: 1 | 2 | 3;
  targetLanguage: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { extractedData, userFields } = req.body;

    if (!extractedData || !userFields || !Array.isArray(userFields)) {
      return res.status(400).json({ error: 'extractedData and userFields are required' });
    }

    // Préparer la description des champs utilisateur pour l'IA
    const fieldsDescription = userFields.map((field: UserField) => {
      const existingValues = [
        ...(field.aiVersions || []).map(v => `Version ${v.version}: ${v.value}`),
        ...(field.languageVersions || []).map(lv => `${lv.language} v${lv.version}: ${lv.value}`)
      ].filter(v => v).slice(0, 3); // Limiter à 3 exemples

      return {
        id: field.id,
        name: field.name,
        tag: field.tag,
        type: field.type,
        baseLanguage: field.baseLanguage,
        existingValues: existingValues.length > 0 ? existingValues : ['Aucune valeur existante']
      };
    });

    // Préparer les données extraites de manière structurée
    const extractedDataStr = JSON.stringify(extractedData, null, 2);

    const prompt = `Tu es un expert en matching de données de CV. Tu dois faire correspondre les données extraites d'un CV avec les champs de la structure utilisateur.

STRUCTURE DES CHAMPS UTILISATEUR :
${JSON.stringify(fieldsDescription, null, 2)}

DONNÉES EXTRAITES DU CV :
${extractedDataStr}

TÂCHE :
Pour chaque donnée extraite, trouve le champ utilisateur le plus approprié en analysant :
1. La sémantique et le sens (ex: "firstName" correspond à "prenom")
2. Les variations linguistiques (ex: "email" = "mail" = "courriel")
3. Les synonymes et équivalents (ex: "jobTitle" = "poste" = "fonction")
4. Le contexte et la structure (ex: expériences dans un tableau "experience" → champs "xp01", "xp02", etc.)

RÈGLES IMPORTANTES :
- Ne crée un mapping QUE si la correspondance est claire et logique (confiance >= 70%)
- Pour les expériences : mapper vers les champs xp01, xp02, xp03... selon l'ordre chronologique
- Pour les formations : mapper vers les champs for01, for02, for03... selon l'ordre chronologique
- Pour les langues : mapper vers langue01, langue02, etc. selon l'ordre d'importance
- Si un champ a déjà une valeur similaire, ne pas créer de mapping (éviter les doublons)
- Utiliser la langue de base du champ (baseLanguage) pour le mapping
- Choisir la version 1, 2 ou 3 selon la disponibilité (priorité: version 1 si vide, sinon 2, sinon 3)

Retourne un JSON avec un tableau "matches" contenant des objets avec :
{
  "extractedKey": "clé exacte dans extractedData (ex: 'firstName', 'experience[0].company')",
  "extractedValue": "valeur extraite (string)",
  "fieldId": "id exact du champ utilisateur (ex: 'prenom', 'xp01entreprise')",
  "fieldName": "nom du champ",
  "fieldTag": "tag du champ",
  "confidence": nombre entre 70 et 100 (confiance du matching),
  "reason": "explication courte du matching (ex: 'firstName correspond sémantiquement à prenom')",
  "targetVersion": 1, 2 ou 3,
  "targetLanguage": "code langue (ex: 'fr', 'en')"
}

IMPORTANT :
- Retourne UNIQUEMENT les mappings avec confidence >= 70%
- Ne crée pas de mapping si la valeur est vide, null ou undefined
- Pour les tableaux (experience, education), créer un mapping pour chaque élément
- Retourne UNIQUEMENT un JSON valide, sans texte supplémentaire, sans markdown`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en matching de données de CV. Tu analyses la sémantique et fais correspondre intelligemment les données extraites avec les champs utilisateur.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2, // Basse température pour plus de précision
    });

    const response = JSON.parse(completion.choices[0].message.content || '{}');
    const matches: FieldMatch[] = response.matches || [];

    return res.status(200).json({
      success: true,
      matches,
    });
  } catch (error: any) {
    console.error('Error matching CV fields:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du matching des champs',
    });
  }
}

