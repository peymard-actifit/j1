import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'GET') {
    try {
      const { id, email } = req.query;
      
      if (id) {
        const result = await sql`
          SELECT * FROM users WHERE id = ${id as string}
        `;
        return res.status(200).json(result.rows[0] || null);
      }
      
      if (email) {
        const result = await sql`
          SELECT * FROM users WHERE email = ${email as string}
        `;
        return res.status(200).json(result.rows[0] || null);
      }
      
      const result = await sql`SELECT * FROM users`;
      return res.status(200).json(result.rows);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id, email, password, name, baseLanguage, isAdmin, data } = req.body;
      
      const result = await sql`
        INSERT INTO users (id, email, password, name, base_language, is_admin, data, created_at, updated_at)
        VALUES (${id}, ${email}, ${password}, ${name}, ${baseLanguage || 'fr'}, ${isAdmin || false}, ${JSON.stringify(data || [])}, NOW(), NOW())
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
      
      const fields = [];
      const values = [];
      
      if (updates.email) {
        fields.push('email');
        values.push(updates.email);
      }
      if (updates.password) {
        fields.push('password');
        values.push(updates.password);
      }
      if (updates.name) {
        fields.push('name');
        values.push(updates.name);
      }
      if (updates.baseLanguage) {
        fields.push('base_language');
        values.push(updates.baseLanguage);
      }
      if (updates.isAdmin !== undefined) {
        fields.push('is_admin');
        values.push(updates.isAdmin);
      }
      if (updates.data) {
        fields.push('data');
        values.push(JSON.stringify(updates.data));
      }
      
      fields.push('updated_at');
      values.push('NOW()');
      
      const setClause = fields.map((field, idx) => 
        `${field} = ${idx < values.length - 1 ? `$${idx + 1}` : 'NOW()'}`
      ).join(', ');
      
      const query = `UPDATE users SET ${setClause} WHERE id = $${values.length}`;
      values.push(id);
      
      await sql.query(query, values);
      
      const result = await sql`SELECT * FROM users WHERE id = ${id}`;
      return res.status(200).json(result.rows[0]);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

