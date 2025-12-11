import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Interface pour le fichier login.json
interface LoginEntry {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: string;
  passwordChangedAt: string;
}

// Fonction pour convertir User DB en LoginEntry
function userToLoginEntry(user: any): LoginEntry {
  return {
    id: user.id,
    email: user.email,
    password: user.password,
    name: user.name,
    createdAt: user.created_at || user.createdAt,
    passwordChangedAt: user.password_changed_at || user.passwordChangedAt || user.updated_at || user.updatedAt || user.created_at || user.createdAt,
  };
}

// Fonction pour initialiser la base de données si nécessaire
async function ensureDatabaseInitialized() {
  try {
    // Vérifier si la table users existe
    const checkTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;
    
    const tableExists = checkTable.rows[0]?.exists;
    
    if (tableExists) {
      return; // La base de données est déjà initialisée
    }

    // Initialiser la base de données
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        base_language VARCHAR(10) DEFAULT 'fr',
        is_admin BOOLEAN DEFAULT FALSE,
        admin_code VARCHAR(50),
        data JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        password_changed_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cv_formats (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        structure JSONB DEFAULT '[]'::jsonb,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cv_generations (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        format_id VARCHAR(255) REFERENCES cv_formats(id) ON DELETE SET NULL,
        field_mappings JSONB DEFAULT '{}'::jsonb,
        pdf_url TEXT,
        generated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cv_formats_metadata ON cv_formats USING GIN(metadata);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cv_generations_user_id ON cv_generations(user_id);`;
    
    console.log('Database initialized automatically');
  } catch (error: any) {
    console.error('Error initializing database:', error);
    // Ne pas bloquer si l'initialisation échoue, on laissera l'erreur remonter
    throw error;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Initialiser la base de données si nécessaire avant toute opération
  try {
    await ensureDatabaseInitialized();
  } catch (initError: any) {
    console.error('Failed to initialize database:', initError);
    // Retourner une erreur explicite si l'initialisation échoue
    return res.status(500).json({ 
      error: 'Database initialization failed',
      details: initError.message 
    });
  }

  if (req.method === 'GET') {
    try {
      const { id, email, exportJson } = req.query;
      
      // Endpoint pour exporter vers login.json
      if (exportJson === 'true') {
        const result = await sql`
          SELECT 
            id,
            email,
            password,
            name,
            created_at,
            updated_at,
            COALESCE(password_changed_at, updated_at, created_at) as password_changed_at
          FROM users
          ORDER BY created_at DESC
        `;
        const entries: LoginEntry[] = result.rows.map(userToLoginEntry);
        return res.status(200).json(entries);
      }
      
      if (id) {
        try {
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
          if (!user) {
            return res.status(200).json(null);
          }
          if (user && user.data) {
            try {
              user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
            } catch (parseError) {
              console.error('Error parsing user data:', parseError);
              user.data = [];
            }
          }
          return res.status(200).json(user);
        } catch (error: any) {
          console.error('Error fetching user by id:', error);
          return res.status(200).json(null);
        }
      }
      
      if (email) {
        try {
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
          if (!user) {
            return res.status(200).json(null);
          }
          if (user && user.data) {
            try {
              user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
            } catch (parseError) {
              console.error('Error parsing user data:', parseError);
              user.data = [];
            }
          }
          return res.status(200).json(user);
        } catch (error: any) {
          console.error('Error fetching user by email:', error);
          // Retourner null au lieu d'une erreur 500 si l'utilisateur n'existe pas
          return res.status(200).json(null);
        }
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
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password et name sont requis' });
      }
      
      const now = new Date().toISOString();
      
      // Vérifier si l'email existe déjà
      try {
        const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
        if (existing.rows.length > 0) {
          return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
      } catch (checkError) {
        console.error('Error checking existing user:', checkError);
        // Continuer même si la vérification échoue
      }
      
      const userId = id || Date.now().toString();
      const userData = data || [];
      
      // Insérer dans la base de données
      try {
        const result = await sql`
          INSERT INTO users (id, email, password, name, base_language, is_admin, data, created_at, updated_at, password_changed_at)
          VALUES (${userId}, ${email}, ${password}, ${name}, ${baseLanguage || 'fr'}, ${isAdmin || false}, ${JSON.stringify(userData)}, ${now}, ${now}, ${now})
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
        if (!user) {
          throw new Error('Échec de la création de l\'utilisateur');
        }
        
        // Parser le champ data si c'est une string
        if (user.data) {
          try {
            user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
          } catch (parseError) {
            console.error('Error parsing user data:', parseError);
            user.data = [];
          }
        } else {
          user.data = [];
        }
        
        // S'assurer que toutes les propriétés sont présentes
        const responseUser = {
          id: user.id,
          email: user.email,
          password: user.password,
          name: user.name,
          baseLanguage: user.baseLanguage || 'fr',
          isAdmin: user.isAdmin || false,
          data: Array.isArray(user.data) ? user.data : [],
          createdAt: user.createdAt || now,
          updatedAt: user.updatedAt || now,
        };
        
        return res.status(201).json(responseUser);
      } catch (dbError: any) {
        console.error('Database error during user creation:', dbError);
        // Si l'erreur est due à une contrainte unique, retourner un message approprié
        if (dbError.message && dbError.message.includes('unique')) {
          return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        throw dbError;
      }
    } catch (error: any) {
      console.error('POST users error:', error);
      return res.status(500).json({ error: error.message || 'Erreur lors de la création de l\'utilisateur' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...updates } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID requis' });
      }
      
      const now = new Date().toISOString();
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      
      if (updates.email !== undefined) {
        updateFields.push('email');
        updateValues.push(updates.email);
      }
      if (updates.password !== undefined) {
        updateFields.push('password');
        updateValues.push(updates.password);
        updateFields.push('password_changed_at');
        updateValues.push(now);
      }
      if (updates.name !== undefined) {
        updateFields.push('name');
        updateValues.push(updates.name);
      }
      if (updates.baseLanguage !== undefined) {
        updateFields.push('base_language');
        updateValues.push(updates.baseLanguage);
      }
      if (updates.isAdmin !== undefined) {
        updateFields.push('is_admin');
        updateValues.push(updates.isAdmin);
      }
      if (updates.data !== undefined) {
        updateFields.push('data');
        updateValues.push(JSON.stringify(updates.data));
      }
      
      updateFields.push('updated_at');
      updateValues.push(now);
      
      if (updateFields.length === 0) {
        // Aucun champ à mettre à jour, juste retourner l'utilisateur
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
        if (!user) {
          return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        if (user && user.data) {
          try {
            user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
          } catch (parseError) {
            console.error('Error parsing user data:', parseError);
            user.data = [];
          }
        }
        return res.status(200).json(user);
      }
      
      // Construire et exécuter les mises à jour champ par champ
      // Cette approche est plus sûre avec @vercel/postgres qui utilise uniquement les template literals
      if (updates.email !== undefined) {
        await sql`UPDATE users SET email = ${updates.email}, updated_at = ${now} WHERE id = ${id}`;
      }
      if (updates.password !== undefined) {
        await sql`UPDATE users SET password = ${updates.password}, password_changed_at = ${now}, updated_at = ${now} WHERE id = ${id}`;
      }
      if (updates.name !== undefined) {
        await sql`UPDATE users SET name = ${updates.name}, updated_at = ${now} WHERE id = ${id}`;
      }
      if (updates.baseLanguage !== undefined) {
        await sql`UPDATE users SET base_language = ${updates.baseLanguage}, updated_at = ${now} WHERE id = ${id}`;
      }
      if (updates.isAdmin !== undefined) {
        await sql`UPDATE users SET is_admin = ${updates.isAdmin}, updated_at = ${now} WHERE id = ${id}`;
      }
      if (updates.data !== undefined) {
        await sql`UPDATE users SET data = ${JSON.stringify(updates.data)}::jsonb, updated_at = ${now} WHERE id = ${id}`;
      }
      
      // S'assurer que updated_at est toujours mis à jour
      if (updateFields.length > 0) {
        await sql`UPDATE users SET updated_at = ${now} WHERE id = ${id}`;
      }
      
      // Récupérer l'utilisateur mis à jour
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
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      if (user && user.data) {
        try {
          user.data = typeof user.data === 'string' ? JSON.parse(user.data) : user.data;
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
          user.data = [];
        }
      } else {
        user.data = [];
      }
      return res.status(200).json(user);
    } catch (error: any) {
      console.error('PUT users error:', error);
      return res.status(500).json({ error: error.message || 'Erreur lors de la mise à jour de l\'utilisateur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id, deleteAll } = req.query;
      
      if (deleteAll === 'true') {
        await sql`DELETE FROM users`;
        return res.status(200).json({ message: 'Tous les utilisateurs ont été supprimés', count: 0 });
      }
      
      if (id) {
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
