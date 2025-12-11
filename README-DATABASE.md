# Configuration de la base de données Vercel

## Initialisation de la base de données

1. **Créer une base de données Postgres sur Vercel** :
   - Aller dans le dashboard Vercel
   - Section "Storage" → "Create Database" → "Postgres"
   - Noter les variables de connexion

2. **Configurer les variables d'environnement** :
   - Dans le dashboard Vercel, aller dans "Settings" → "Environment Variables"
   - Ajouter `OPENAI_API_KEY` (déjà configuré)
   - Les variables de connexion Postgres sont automatiquement ajoutées par Vercel

3. **Exécuter le script SQL d'initialisation** :
   - Aller dans l'onglet "Storage" de votre projet Vercel
   - Ouvrir la console SQL
   - Exécuter le contenu du fichier `scripts/init-database.sql`

## Structure de la base de données

### Table `users`
- `id` : Identifiant unique
- `email` : Email unique
- `password` : Mot de passe (à hasher en production)
- `name` : Nom de l'utilisateur
- `base_language` : Langue de base (défaut: 'fr')
- `is_admin` : Statut administrateur
- `data` : Données CV au format JSONB
- `created_at`, `updated_at` : Timestamps

### Table `cv_formats`
- `id` : Identifiant unique
- `name` : Nom du format
- `description` : Description
- `metadata` : Métadonnées (pays, destinataires, tags) au format JSONB
- `structure` : Structure du format au format JSONB
- `created_by` : ID de l'admin créateur
- `created_at`, `updated_at` : Timestamps

### Table `cv_generations`
- `id` : Identifiant unique
- `user_id` : Référence à l'utilisateur
- `format_id` : Référence au format
- `field_mappings` : Mappings des champs au format JSONB
- `pdf_url` : URL du PDF généré
- `generated_at` : Date de génération

## API Endpoints

### `/api/users`
- `GET ?id=xxx` : Récupérer un utilisateur par ID
- `GET ?email=xxx` : Récupérer un utilisateur par email
- `GET` : Récupérer tous les utilisateurs
- `POST` : Créer un utilisateur
- `PUT` : Mettre à jour un utilisateur

### `/api/cv-formats`
- `GET ?id=xxx` : Récupérer un format
- `GET ?country=xxx&targetRecipient=xxx&search=xxx` : Filtrer les formats
- `POST` : Créer un format (admin uniquement)
- `PUT` : Mettre à jour un format
- `DELETE ?id=xxx` : Supprimer un format (admin uniquement)

### `/api/ai/analyze-cv`
- `POST` : Analyser un CV avec OpenAI
  - Body: `{ fileContent, fileName, fileType }`

### `/api/ai/chat`
- `POST` : Appel IA générique
  - Body: `{ type, input, userId, userData }`
  - Types: `adapt_to_job_offer`, `optimize_for_ai_parsing`, `get_advice`, `search_jobs`, etc.

