import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      return res.status(200).json({ 
        message: 'Database already initialized',
        initialized: false 
      });
    }

    // Créer la table users
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

    // Créer la table cv_formats
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

    // Créer la table cv_generations
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

    // Créer les index
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cv_formats_metadata ON cv_formats USING GIN(metadata);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cv_generations_user_id ON cv_generations(user_id);`;

    return res.status(200).json({ 
      message: 'Database initialized successfully',
      initialized: true 
    });
  } catch (error: any) {
    console.error('Error initializing database:', error);
    return res.status(500).json({ 
      error: error.message || 'Error initializing database',
      details: error.stack 
    });
  }
}

