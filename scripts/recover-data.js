// Script pour récupérer les données perdues depuis localStorage
// Usage: Ouvrir la console du navigateur et exécuter ce code

function recoverUserData() {
  console.log('=== RÉCUPÉRATION DES DONNÉES UTILISATEUR ===\n');
  
  // Récupérer tous les clés localStorage
  const allKeys = Object.keys(localStorage);
  let foundData = null;
  let foundUser = null;
  
  // Chercher dans toutes les clés possibles
  for (const key of allKeys) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        const parsed = JSON.parse(value);
        
        // Chercher un objet utilisateur avec des données
        if (parsed && typeof parsed === 'object') {
          // Si c'est un tableau de champs (data)
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && parsed[0].name) {
            console.log(`✅ Données trouvées dans ${key}: ${parsed.length} champs`);
            foundData = parsed;
          }
          // Si c'est un utilisateur avec des données
          else if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
            console.log(`✅ Utilisateur trouvé dans ${key}: ${parsed.data.length} champs`);
            foundUser = parsed;
            foundData = parsed.data;
          }
          // Si c'est un utilisateur complet
          else if (parsed.email && parsed.id) {
            console.log(`ℹ️ Utilisateur trouvé dans ${key}: ${parsed.email}`);
            if (!foundUser) {
              foundUser = parsed;
            }
          }
        }
      }
    } catch (e) {
      // Ignorer les erreurs de parsing
    }
  }
  
  if (foundData && foundData.length > 0) {
    console.log('\n=== DONNÉES RÉCUPÉRÉES ===');
    console.log(`Nombre de champs: ${foundData.length}`);
    console.log('Champs:', foundData.map(f => f.name || f.tag || f.id).join(', '));
    
    // Récupérer l'utilisateur actuel
    const currentUserStr = localStorage.getItem('j1_current_user_cache');
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        console.log('\n=== MISE À JOUR DE L\'UTILISATEUR ACTUEL ===');
        console.log(`Email actuel: ${currentUser.email}`);
        console.log(`Données actuelles: ${currentUser.data?.length || 0} champs`);
        
        // Restaurer les données
        currentUser.data = foundData;
        currentUser.updatedAt = new Date().toISOString();
        
        localStorage.setItem('j1_current_user_cache', JSON.stringify(currentUser));
        console.log(`✅ Données restaurées: ${foundData.length} champs`);
        console.log('\nRechargez la page pour voir les changements.');
      } catch (e) {
        console.error('Erreur lors de la mise à jour:', e);
      }
    } else {
      console.log('\n⚠️ Aucun utilisateur actuel trouvé dans le cache.');
      console.log('Les données sont disponibles mais ne peuvent pas être restaurées automatiquement.');
      console.log('Données:', JSON.stringify(foundData, null, 2));
    }
  } else {
    console.log('\n❌ Aucune donnée trouvée dans localStorage.');
    console.log('Les données peuvent avoir été perdues définitivement.');
  }
  
  return { foundData, foundUser };
}

// Exécuter la fonction
recoverUserData();
