// Script pour lister tous les utilisateurs depuis localStorage
// Usage: Ouvrir la console du navigateur et exécuter ce code

function listUsersFromLocalStorage() {
  console.log('=== LISTE DES UTILISATEURS ===\n');
  
  // Récupérer l'ID utilisateur actuel
  const currentUserId = localStorage.getItem('j1_current_user');
  console.log('ID utilisateur actuel:', currentUserId || 'Aucun');
  
  // Récupérer le cache utilisateur
  const cachedUser = localStorage.getItem('j1_current_user_cache');
  if (cachedUser) {
    try {
      const user = JSON.parse(cachedUser);
      console.log('\n=== UTILISATEUR EN CACHE ===');
      console.log('ID:', user.id);
      console.log('Nom:', user.name);
      console.log('Email:', user.email);
      console.log('Mot de passe:', user.password);
      console.log('Langue de base:', user.baseLanguage);
      console.log('Admin:', user.isAdmin);
      console.log('Nombre de champs:', user.data?.length || 0);
      console.log('Créé le:', user.createdAt);
      console.log('Modifié le:', user.updatedAt);
    } catch (e) {
      console.error('Erreur lors du parsing du cache:', e);
    }
  } else {
    console.log('\nAucun utilisateur en cache');
  }
  
  // Essayer de récupérer depuis l'API
  console.log('\n=== TENTATIVE DE RÉCUPÉRATION DEPUIS L\'API ===');
  if (currentUserId) {
    fetch(`/api/users/${currentUserId}`)
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        throw new Error(`HTTP ${res.status}`);
      })
      .then(user => {
        console.log('Utilisateur trouvé dans l\'API:');
        console.log('ID:', user.id);
        console.log('Nom:', user.name);
        console.log('Email:', user.email);
        console.log('Mot de passe:', user.password);
      })
      .catch(err => {
        console.error('Erreur API:', err.message);
        console.log('L\'API ne répond pas ou l\'utilisateur n\'existe pas dans la base de données');
      });
  }
  
  console.log('\n=== INSTRUCTIONS ===');
  console.log('Pour tester la connexion, utilisez:');
  console.log('Email:', cachedUser ? JSON.parse(cachedUser).email : 'Non disponible');
  console.log('Mot de passe:', cachedUser ? JSON.parse(cachedUser).password : 'Non disponible');
}

// Exécuter la fonction
listUsersFromLocalStorage();
