import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileContent } = req.body;

    if (!fileContent) {
      return res.status(400).json({ error: 'File content is required' });
    }

    // Utiliser documint pour extraire le texte du PDF
    if (process.env.DOCUMINT_API_KEY) {
      try {
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
          return res.status(200).json({
            success: true,
            text: documintData.text || '',
          });
        } else {
          const errorText = await documintResponse.text();
          console.error('Documint API error:', errorText);
          return res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'extraction du texte avec documint',
          });
        }
      } catch (documintError: any) {
        console.error('Error calling documint:', documintError);
        return res.status(500).json({
          success: false,
          error: documintError.message || 'Erreur lors de l\'appel à documint',
        });
      }
    } else {
      return res.status(500).json({
        success: false,
        error: 'DOCUMINT_API_KEY non configurée',
      });
    }
  } catch (error: any) {
    console.error('Error extracting PDF text:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'extraction du texte du PDF',
    });
  }
}

