import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileContent, fileName, fileType, userFields } = req.body;

    if (!fileContent) {
      return res.status(400).json({ error: 'File content is required' });
    }

    // Si c'est un PDF et que l'API documint est disponible, l'utiliser pour extraire le texte
    let extractedText = fileContent;
    if (fileType === 'application/pdf' && process.env.DOCUMINT_API_KEY) {
      try {
        // Utiliser documint pour extraire le texte du PDF
        const documintResponse = await fetch('https://api.documint.ai/v1/extract', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.DOCUMINT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: fileContent, // base64
            format: 'text',
          }),
        });

        if (documintResponse.ok) {
          const documintData = await documintResponse.json();
          extractedText = documintData.text || fileContent;
        }
      } catch (documintError) {
        console.warn('Erreur lors de l\'extraction avec documint, utilisation du contenu brut:', documintError);
        // Continuer avec le contenu brut si documint échoue
      }
    }

    // Préparer la description de la structure des champs utilisateur
    let fieldsContext = '';
    if (userFields && Array.isArray(userFields) && userFields.length > 0) {
      fieldsContext = `\n\nSTRUCTURE DES CHAMPS UTILISATEUR (utilise ces IDs et noms pour mapper les données) :\n`;
      userFields.forEach((field: any) => {
        const existingValues = [
          ...(field.aiVersions || []).map((v: any) => `Version ${v.version}: ${v.value}`).filter((v: string) => v && v.length > 0),
          ...(field.languageVersions || []).map((lv: any) => `${lv.language} v${lv.version}: ${lv.value}`).filter((v: string) => v && v.length > 0)
        ].slice(0, 2); // Limiter à 2 exemples
        
        fieldsContext += `- ID: "${field.id}", Nom: "${field.name}", Tag: "${field.tag}", Type: "${field.type}"`;
        if (existingValues.length > 0) {
          fieldsContext += `, Valeurs existantes: ${existingValues.join(', ')}`;
        }
        fieldsContext += `\n`;
      });
      
      fieldsContext += `\nRÈGLES DE MAPPING :\n`;
      fieldsContext += `- Les champs commençant par "xp" suivis de 01-10 sont pour les expériences professionnelles (ex: xp01entreprise, xp01poste, xp01datedebut, etc.)\n`;
      fieldsContext += `- Les champs commençant par "for" suivis de 01-10 sont pour les formations (ex: for01diplome, for01ecole, etc.)\n`;
      fieldsContext += `- Les champs "langue01", "langue02", etc. sont pour les langues\n`;
      fieldsContext += `- Les champs "niveaulangue01", "niveaulangue02", etc. sont pour les niveaux de langues\n`;
      fieldsContext += `- Les autres champs correspondent aux informations personnelles et professionnelles\n`;
    }

    // Préparer le prompt pour l'analyse du CV avec mapping vers la structure JustOne
    const prompt = `Tu es un expert en extraction de données de CV. Analyse ce CV et extrais TOUTES les informations de manière structurée et précise.

IMPORTANT : 
- Extrais TOUTES les informations présentes dans le CV, même si elles semblent incomplètes
- Utilise les noms de champs EXACTS indiqués ci-dessous
- Pour les dates, utilise le format YYYY-MM-DD si possible, sinon garde le format original
- Pour les tableaux (expériences, formations), extrais TOUS les éléments présents, même s'il y en a plus de 10
- Ne laisse AUCUN champ vide si l'information est présente dans le CV
- MAPPE les données extraites vers la structure des champs utilisateur fournie ci-dessous${fieldsContext ? ' (voir STRUCTURE DES CHAMPS UTILISATEUR)' : ''}

Retourne un JSON avec les champs suivants (utilise les noms EXACTS) :

Informations personnelles :
- firstName: prénom (OBLIGATOIRE si présent)
- lastName: nom de famille (OBLIGATOIRE si présent)
- email: adresse email (si présente)
- phone: numéro de téléphone (peut être mobile, fixe, etc.)
- addressLine1: première ligne d'adresse (rue, numéro)
- addressLine2: deuxième ligne d'adresse (complément, appartement, etc.)
- postalCode: code postal
- city: ville
- country: pays
- region: région, département, état, province (si présent)
- birthDate: date de naissance (format YYYY-MM-DD si disponible, sinon format original)
- birthPlace: lieu de naissance

Poste et résumé :
- jobTitle: poste recherché, poste actuel, ou titre professionnel
- summary: résumé professionnel, profil, présentation, about me, ou toute description personnelle

Expériences professionnelles (tableau) :
- experience: tableau d'objets avec {title, company, startDate, endDate, description, mission, results}
  - title: intitulé du poste, fonction, rôle
  - company: nom de l'entreprise, organisation, employeur
  - startDate: date de début (format YYYY-MM ou YYYY-MM-DD si possible)
  - endDate: date de fin (format YYYY-MM ou YYYY-MM-DD, ou "en cours", "present", "actuel" si toujours en poste)
  - description: description générale du poste
  - mission: missions principales, responsabilités
  - results: résultats, réalisations, accomplissements
  Extrais TOUTES les expériences présentes dans le CV, même s'il y en a plus de 10

Formations (tableau) :
- education: tableau d'objets avec {degree, school, startDate, endDate, description}
  - degree: diplôme, certification, titre obtenu
  - school: établissement, université, école
  - startDate: date de début (format YYYY-MM ou YYYY-MM-DD)
  - endDate: date de fin ou date d'obtention (format YYYY-MM ou YYYY-MM-DD)
  - description: mention, spécialité, options
  Extrais TOUTES les formations présentes dans le CV

Compétences :
- skills: tableau de compétences (chaque élément est une chaîne)
  Extrais toutes les compétences techniques, linguistiques, professionnelles mentionnées

Langues :
- languages: tableau d'objets avec {language, level}
  - language: nom de la langue (français, anglais, espagnol, etc.)
  - level: niveau (A1, A2, B1, B2, C1, C2, natif, courant, bilingue, etc.)
  Extrais toutes les langues mentionnées, la langue principale en premier

Certifications :
- certifications: tableau de certifications (chaque élément est une chaîne)
  Extrais toutes les certifications, habilitations, permis mentionnés

Publications (si présentes) :
- publications: tableau de publications (chaque élément est une chaîne)

Présentations (si présentes) :
- presentations: tableau de présentations (chaque élément est une chaîne)

Expériences associatives (si présentes) :
- associativeExperiences: tableau d'objets avec {duration, description}

Contenu du CV:
${extractedText.substring(0, 50000)}${fieldsContext}

Retourne UNIQUEMENT un JSON valide, sans texte supplémentaire, sans markdown, sans commentaires. Le JSON doit être directement parsable.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en analyse de CV. Tu extrais les informations de manière structurée et précise.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    return res.status(200).json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    console.error('Error analyzing CV:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'analyse du CV',
    });
  }
}

