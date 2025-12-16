import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Ajouter les headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Format ID is required' });
  }

  try {
    if (req.method === 'GET') {
      // GET /api/cv-formats/[id] - Récupérer un format CV par ID
      const result = await sql`
        SELECT * FROM cv_formats WHERE id = ${id} LIMIT 1
      `;

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Format not found' });
      }

      const row = result.rows[0];
      return res.status(200).json({
        id: row.id,
        name: row.name,
        description: row.description,
        metadata: row.metadata || {},
        structure: row.structure || [],
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });

    } else if (req.method === 'PUT') {
      // PUT /api/cv-formats/[id] - Mettre à jour un format CV
      const { name, description, metadata, structure, createdBy } = req.body;

      const now = new Date().toISOString();
      const jsonMetadata = JSON.stringify(metadata || {});
      const jsonStructure = JSON.stringify(structure || []);

      await sql`
        UPDATE cv_formats 
        SET name = ${name},
            description = ${description || ''},
            metadata = ${jsonMetadata}::jsonb,
            structure = ${jsonStructure}::jsonb,
            created_by = ${createdBy || null},
            updated_at = ${now}
        WHERE id = ${id}
      `;

      return res.status(200).json({
        id,
        name,
        description: description || '',
        metadata: metadata || {},
        structure: structure || [],
        createdBy: createdBy || null,
        updatedAt: now,
      });

    } else if (req.method === 'DELETE') {
      // DELETE /api/cv-formats/[id] - Supprimer un format CV
      await sql`DELETE FROM cv_formats WHERE id = ${id}`;
      return res.status(200).json({ message: 'Format deleted' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error in cv-formats/[id] API:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error.stack 
    });
  }
}
