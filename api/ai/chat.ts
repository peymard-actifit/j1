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
    const { type, input, userId, userData } = req.body;

    if (!type || !input) {
      return res.status(400).json({ error: 'Type and input are required' });
    }

    let prompt = '';
    let systemMessage = '';

    switch (type) {
      case 'adapt_to_job_offer':
        systemMessage = 'Tu es un expert en recrutement qui adapte des CVs à des offres d\'emploi spécifiques.';
        prompt = `Adapte ce CV aux exigences de cette offre d'emploi:
        
        Offre: ${JSON.stringify(input.jobOffer)}
        Données CV: ${JSON.stringify(userData)}
        
        Retourne un CV optimisé avec les modifications suggérées.`;
        break;

      case 'optimize_for_ai_parsing':
        systemMessage = 'Tu es un expert en optimisation de CV pour le parsing par IA.';
        prompt = `Optimise ce CV pour qu'il soit mieux analysé par les systèmes de recrutement IA:
        
        Données CV: ${JSON.stringify(userData)}
        Mots-clés à exprimer: ${input.keywords?.join(', ') || 'aucun'}
        
        Retourne un CV optimisé avec les améliorations.`;
        break;

      case 'get_advice':
        systemMessage = 'Tu es un conseiller en carrière qui donne des conseils pour améliorer l\'employabilité.';
        prompt = `Analyse ce profil et donne des conseils pour améliorer l'employabilité:
        
        Données: ${JSON.stringify(userData)}
        Catégorie: ${input.category || 'général'}
        Budget: ${input.budget || 'non spécifié'}
        
        Retourne des conseils structurés avec des actions concrètes, formations, certifications.`;
        break;

      case 'search_jobs':
        systemMessage = 'Tu es un expert en recherche d\'emploi.';
        prompt = `Trouve des offres d'emploi correspondant à ce profil:
        
        Profil: ${JSON.stringify(userData)}
        Type de poste: ${input.jobType || 'non spécifié'}
        Fonction: ${input.function || 'non spécifiée'}
        
        Retourne une liste d'offres d'emploi pertinentes avec leurs critères.`;
        break;

      default:
        systemMessage = 'Tu es un assistant IA spécialisé dans l\'aide à la création de CV.';
        prompt = input.prompt || JSON.stringify(input);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Error in AI chat:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'appel IA',
    });
  }
}

