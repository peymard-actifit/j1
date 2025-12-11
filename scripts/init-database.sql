-- Script d'initialisation de la base de données Vercel Postgres pour JustOne

-- Table des utilisateurs
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

-- Table des formats de CV
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

-- Table des générations de CV
CREATE TABLE IF NOT EXISTS cv_generations (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format_id VARCHAR(255) REFERENCES cv_formats(id) ON DELETE SET NULL,
  field_mappings JSONB DEFAULT '{}'::jsonb,
  pdf_url TEXT,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_cv_formats_metadata ON cv_formats USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_cv_generations_user_id ON cv_generations(user_id);

