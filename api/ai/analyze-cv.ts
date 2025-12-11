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
    const { fileContent, fileName, fileType } = req.body;

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

    // Préparer le prompt pour l'analyse du CV avec mapping vers la structure JustOne
    const prompt = `Analyse ce CV et extrais toutes les informations structurées selon la structure JustOne.
    Retourne un JSON avec les champs suivants (utilise les noms exacts) :
    
    Informations personnelles :
    - firstName: prénom
    - lastName: nom de famille
    - email: adresse email
    - phone: numéro de téléphone
    - addressLine1: première ligne d'adresse
    - addressLine2: deuxième ligne d'adresse (si présente)
    - postalCode: code postal
    - city: ville
    - country: pays
    - region: région (si présente)
    - birthDate: date de naissance (format YYYY-MM-DD si disponible)
    - birthPlace: lieu de naissance
    
    Poste et résumé :
    - jobTitle: poste recherché ou actuel
    - summary: résumé professionnel ou profil
    
    Expériences professionnelles (tableau) :
    - experience: tableau d'objets avec {title, company, startDate, endDate, description, mission, results}
      (jusqu'à 10 expériences, numérotées de 1 à 10)
    
    Formations (tableau) :
    - education: tableau d'objets avec {degree, school, startDate, endDate, description}
      (jusqu'à 10 formations, numérotées de 1 à 10)
    
    Compétences :
    - skills: tableau de compétences (chaque élément est une chaîne)
    
    Langues :
    - languages: tableau d'objets avec {language, level}
      (langue principale en premier)
    
    Certifications :
    - certifications: tableau de certifications (chaque élément est une chaîne)
    
    Publications (si présentes) :
    - publications: tableau de publications (chaque élément est une chaîne)
    
    Présentations (si présentes) :
    - presentations: tableau de présentations (chaque élément est une chaîne)
    
    Expériences associatives (si présentes) :
    - associativeExperiences: tableau d'objets avec {duration, description}
    
    Contenu du CV:
    ${extractedText.substring(0, 50000)} // Limiter à 50000 caractères pour éviter les erreurs
    
    Retourne uniquement le JSON valide, sans texte supplémentaire ni markdown.`;

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

