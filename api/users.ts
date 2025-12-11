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
          SELECT 
            id,
            email,
            password,
            name,
            base_language as "baseLanguage",
            is_admin as "isAdmin",
            data,
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM users WHERE id = ${id as string}
        `;
        const user = result.rows[0];
        if (user && user.data) {
          user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
        }
        return res.status(200).json(user || null);
      }
      
      if (email) {
        const result = await sql`
          SELECT 
            id,
            email,
            password,
            name,
            base_language as "baseLanguage",
            is_admin as "isAdmin",
            data,
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM users WHERE email = ${email as string}
        `;
        const user = result.rows[0];
        if (user && user.data) {
          user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
        }
        return res.status(200).json(user || null);
      }
      
      const result = await sql`
        SELECT 
          id,
          email,
          password,
          name,
          base_language as "baseLanguage",
          is_admin as "isAdmin",
          data,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM users
      `;
      const users = result.rows.map(user => {
        if (user.data && typeof user.data === 'string') {
          user.data = JSON.parse(user.data);
        }
        return user;
      });
      return res.status(200).json(users);
    } catch (error: any) {
      console.error('GET users error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id, email, password, name, baseLanguage, isAdmin, data } = req.body;
      
      const result = await sql`
        INSERT INTO users (id, email, password, name, base_language, is_admin, data, created_at, updated_at)
        VALUES (${id}, ${email}, ${password}, ${name}, ${baseLanguage || 'fr'}, ${isAdmin || false}, ${JSON.stringify(data || [])}, NOW(), NOW())
        RETURNING 
          id,
          email,
          password,
          name,
          base_language as "baseLanguage",
          is_admin as "isAdmin",
          data,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
      
      const user = result.rows[0];
      if (user && user.data) {
        user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
      }
      return res.status(201).json(user);
    } catch (error: any) {
      console.error('POST users error:', error);
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
      
      const result = await sql`
        SELECT 
          id,
          email,
          password,
          name,
          base_language as "baseLanguage",
          is_admin as "isAdmin",
          data,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM users WHERE id = ${id}
      `;
      const user = result.rows[0];
      if (user && user.data) {
        user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
      }
      return res.status(200).json(user);
    } catch (error: any) {
      console.error('PUT users error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id, deleteAll } = req.query;
      
      if (deleteAll === 'true') {
        // Supprimer tous les utilisateurs
        await sql`DELETE FROM users`;
        return res.status(200).json({ message: 'Tous les utilisateurs ont été supprimés', count: 0 });
      }
      
      if (id) {
        // Supprimer un utilisateur spécifique
        await sql`DELETE FROM users WHERE id = ${id as string}`;
        return res.status(200).json({ message: 'Utilisateur supprimé', id });
      }
      
      return res.status(400).json({ error: 'ID requis ou deleteAll=true' });
    } catch (error: any) {
      console.error('DELETE users error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

