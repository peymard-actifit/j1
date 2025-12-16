import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Ajouter les headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // GET /api/users?email=xxx - Récupérer un utilisateur par email
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      const result = await sql`
        SELECT id, email, password, name, base_language, is_admin, admin_code, data, created_at, updated_at, password_changed_at
        FROM users 
        WHERE email = ${email}
        LIMIT 1
      `;

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      return res.status(200).json({
        id: user.id,
        email: user.email,
        password: user.password,
        name: user.name,
        baseLanguage: user.base_language,
        isAdmin: user.is_admin,
        adminCode: user.admin_code,
        data: user.data || [],
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        passwordChangedAt: user.password_changed_at,
      });

    } else if (req.method === 'POST') {
      // POST /api/users - Créer un nouvel utilisateur
      const { id, email, password, name, baseLanguage, isAdmin, adminCode, data } = req.body;

      if (!id || !email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const now = new Date().toISOString();
      const jsonData = JSON.stringify(data || []);

      await sql`
        INSERT INTO users (id, email, password, name, base_language, is_admin, admin_code, data, created_at, updated_at, password_changed_at)
        VALUES (${id}, ${email}, ${password}, ${name}, ${baseLanguage || 'fr'}, ${isAdmin || false}, ${adminCode || null}, ${jsonData}::jsonb, ${now}, ${now}, ${now})
      `;

      return res.status(201).json({
        id,
        email,
        password,
        name,
        baseLanguage: baseLanguage || 'fr',
        isAdmin: isAdmin || false,
        adminCode: adminCode || null,
        data: data || [],
        createdAt: now,
        updatedAt: now,
        passwordChangedAt: now,
      });

    } else if (req.method === 'DELETE') {
      // DELETE /api/users - Supprimer tous les utilisateurs (admin only)
      await sql`DELETE FROM users`;
      return res.status(200).json({ message: 'All users deleted' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error in users API:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error.stack 
    });
  }
}
