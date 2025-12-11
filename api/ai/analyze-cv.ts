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

    // Préparer le prompt pour l'analyse du CV
    const prompt = `Analyse ce CV et extrais toutes les informations structurées. 
    Retourne un JSON avec les champs suivants :
    - name: nom complet
    - email: adresse email
    - phone: numéro de téléphone
    - address: adresse complète
    - summary: résumé professionnel
    - experience: tableau d'objets avec {title, company, startDate, endDate, description}
    - education: tableau d'objets avec {degree, school, startDate, endDate, description}
    - skills: tableau de compétences
    - languages: tableau de langues avec niveau
    - certifications: tableau de certifications
    
    Contenu du CV:
    ${fileContent}
    
    Retourne uniquement le JSON, sans texte supplémentaire.`;

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

