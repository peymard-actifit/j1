// Script pour synchroniser la base de données vers login.json
// Usage: node scripts/sync-login-json.js

const fs = require('fs');
const path = require('path');

// Ce script nécessite d'être exécuté avec les variables d'environnement Vercel
// ou d'avoir accès à la base de données

async function syncLoginJson() {
  try {
    // Appeler l'API pour exporter les données
    const response = await fetch('http://localhost:3000/api/users?exportJson=true');
    const entries = await response.json();
    
    const loginJsonPath = path.join(__dirname, '..', 'login.json');
    fs.writeFileSync(loginJsonPath, JSON.stringify(entries, null, 2), 'utf-8');
    
    console.log(`✅ Synchronisé ${entries.length} utilisateur(s) vers login.json`);
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error);
    process.exit(1);
  }
}

syncLoginJson();









