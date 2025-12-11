# JustOne (J1)

Outil de gestion de production de CVs avec intelligence artificielle.

## Fonctionnalités

- **Gestion de données utilisateur** : Stockage structuré et multilingue des informations CV
- **Analyse de CV par IA** : Import et analyse automatique de CVs (PDF, Word, LaTeX, Excel, PowerPoint)
- **Éditeur de données** : Interface intuitive pour gérer les données CV avec support multilingue
- **Formats de CV** : Système de formats personnalisables pour générer des CVs adaptés
- **Modules spécialisés** :
  - **JustPush** : Envoi de profils sur les réseaux sociaux
  - **JustWeb** : Création et publication de sites web de profil
  - **JustBoost** : Conseils d'amélioration et formations
  - **JustFind** : Recherche de projets et opportunités
  - **JobDone** : Certifications employeurs
  - **JustRPA** : Remplissage automatisé de formulaires

## Prérequis

- Node.js (version 18 ou supérieure)
- npm ou yarn
- Clé API OpenAI (optionnelle pour les fonctionnalités IA)

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env` à la racine du projet :

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

## Développement

Lancer le serveur de développement :

```bash
npm run dev
```

Le projet sera accessible sur `http://localhost:5173`

## Build

Créer une build de production :

```bash
npm run build
```

## Preview

Prévisualiser la build de production :

```bash
npm run preview
```

## Linting

Vérifier le code avec ESLint :

```bash
npm run lint
```

## Technologies

- **React** 18.3.1
- **Vite** 5.3.1
- **TypeScript** 5.5.3
- **React Router** pour la navigation
- **Axios** pour les requêtes HTTP
- **ESLint** pour le linting

## Structure du projet

```
src/
├── components/      # Composants React
├── contexts/        # Contextes React (Auth, etc.)
├── types/          # Types TypeScript
└── utils/          # Utilitaires (storage, AI, etc.)
```

## Mode administrateur

Le code administrateur par défaut est : `12411241`

## Stockage des données

Actuellement, les données sont stockées dans le localStorage du navigateur. Une migration vers une base de données backend est prévue.

