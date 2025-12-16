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
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    if (req.method === 'GET') {
      // GET /api/users/[id] - Récupérer un utilisateur par ID
      const result = await sql`
        SELECT id, email, password, name, base_language, is_admin, admin_code, data, created_at, updated_at, password_changed_at
        FROM users 
        WHERE id = ${id}
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

    } else if (req.method === 'PUT') {
      // PUT /api/users/[id] - Mettre à jour un utilisateur
      const { email, password, name, baseLanguage, isAdmin, adminCode, data } = req.body;

      const now = new Date().toISOString();
      const jsonData = JSON.stringify(data || []);

      // Vérifier si l'utilisateur existe
      const existing = await sql`SELECT id FROM users WHERE id = ${id}`;
      
      if (existing.rows.length === 0) {
        // Créer l'utilisateur s'il n'existe pas
        await sql`
          INSERT INTO users (id, email, password, name, base_language, is_admin, admin_code, data, created_at, updated_at, password_changed_at)
          VALUES (${id}, ${email}, ${password}, ${name}, ${baseLanguage || 'fr'}, ${isAdmin || false}, ${adminCode || null}, ${jsonData}::jsonb, ${now}, ${now}, ${now})
        `;
      } else {
        // Mettre à jour l'utilisateur existant
        await sql`
          UPDATE users 
          SET email = ${email},
              password = ${password},
              name = ${name},
              base_language = ${baseLanguage || 'fr'},
              is_admin = ${isAdmin || false},
              admin_code = ${adminCode || null},
              data = ${jsonData}::jsonb,
              updated_at = ${now}
          WHERE id = ${id}
        `;
      }

      return res.status(200).json({
        id,
        email,
        password,
        name,
        baseLanguage: baseLanguage || 'fr',
        isAdmin: isAdmin || false,
        adminCode: adminCode || null,
        data: data || [],
        updatedAt: now,
      });

    } else if (req.method === 'DELETE') {
      // DELETE /api/users/[id] - Supprimer un utilisateur
      await sql`DELETE FROM users WHERE id = ${id}`;
      return res.status(200).json({ message: 'User deleted' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error in users/[id] API:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error.stack 
    });
  }
}
