import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Ajouter les headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // GET /api/cv-formats - Récupérer tous les formats CV
      const { country, targetRecipient, search } = req.query;

      let query = 'SELECT * FROM cv_formats WHERE 1=1';
      const params: string[] = [];

      if (country && typeof country === 'string') {
        params.push(country);
        query += ` AND metadata->>'country' = $${params.length}`;
      }

      if (targetRecipient && typeof targetRecipient === 'string') {
        params.push(targetRecipient);
        query += ` AND metadata->>'targetRecipient' = $${params.length}`;
      }

      if (search && typeof search === 'string') {
        params.push(`%${search}%`);
        query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
      }

      query += ' ORDER BY created_at DESC';

      // Exécuter la requête avec les paramètres
      const result = params.length > 0
        ? await sql.query(query, params)
        : await sql`SELECT * FROM cv_formats ORDER BY created_at DESC`;

      const formats = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        metadata: row.metadata || {},
        structure: row.structure || [],
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.status(200).json(formats);

    } else if (req.method === 'POST') {
      // POST /api/cv-formats - Créer un nouveau format CV
      const { id, name, description, metadata, structure, createdBy } = req.body;

      if (!id || !name) {
        return res.status(400).json({ error: 'ID and name are required' });
      }

      const now = new Date().toISOString();
      const jsonMetadata = JSON.stringify(metadata || {});
      const jsonStructure = JSON.stringify(structure || []);

      await sql`
        INSERT INTO cv_formats (id, name, description, metadata, structure, created_by, created_at, updated_at)
        VALUES (${id}, ${name}, ${description || ''}, ${jsonMetadata}::jsonb, ${jsonStructure}::jsonb, ${createdBy || null}, ${now}, ${now})
      `;

      return res.status(201).json({
        id,
        name,
        description: description || '',
        metadata: metadata || {},
        structure: structure || [],
        createdBy: createdBy || null,
        createdAt: now,
        updatedAt: now,
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error in cv-formats API:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error.stack 
    });
  }
}
