import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'GET') {
    try {
      const { id, country, targetRecipient, search } = req.query;
      
      let query = 'SELECT * FROM cv_formats WHERE 1=1';
      const params: any[] = [];
      let paramCount = 1;

      if (id) {
        query += ` AND id = $${paramCount}`;
        params.push(id);
        paramCount++;
      }

      if (country) {
        query += ` AND metadata->>'country' LIKE $${paramCount}`;
        params.push(`%${country}%`);
        paramCount++;
      }

      if (targetRecipient) {
        query += ` AND metadata->'targetRecipients' @> $${paramCount}`;
        params.push(JSON.stringify([targetRecipient]));
        paramCount++;
      }

      if (search) {
        query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
        params.push(`%${search}%`, `%${search}%`);
      }

      const result = await sql.query(query, params);
      return res.status(200).json(result.rows);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id, name, description, metadata, structure, createdBy } = req.body;
      
      const result = await sql`
        INSERT INTO cv_formats (id, name, description, metadata, structure, created_by, created_at, updated_at)
        VALUES (${id}, ${name}, ${description || null}, ${JSON.stringify(metadata || {})}, ${JSON.stringify(structure || [])}, ${createdBy || null}, NOW(), NOW())
        RETURNING *
      `;
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...updates } = req.body;
      
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.name) {
        fields.push(`name = $${paramCount}`);
        values.push(updates.name);
        paramCount++;
      }
      if (updates.description !== undefined) {
        fields.push(`description = $${paramCount}`);
        values.push(updates.description);
        paramCount++;
      }
      if (updates.metadata) {
        fields.push(`metadata = $${paramCount}`);
        values.push(JSON.stringify(updates.metadata));
        paramCount++;
      }
      if (updates.structure) {
        fields.push(`structure = $${paramCount}`);
        values.push(JSON.stringify(updates.structure));
        paramCount++;
      }
      
      fields.push('updated_at = NOW()');
      values.push(id);
      
      const query = `UPDATE cv_formats SET ${fields.join(', ')} WHERE id = $${paramCount}`;
      await sql.query(query, values);
      
      const result = await sql`SELECT * FROM cv_formats WHERE id = ${id}`;
      return res.status(200).json(result.rows[0]);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await sql`DELETE FROM cv_formats WHERE id = ${id as string}`;
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

